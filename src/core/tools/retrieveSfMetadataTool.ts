import * as path from "path"
import { execSync } from "child_process"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

/**
 * Metadata type configuration for SF CLI commands
 */
interface MetadataTypeConfig {
	// The metadata type name as used by SF CLI
	cliType: string
	// Whether this type supports listing all components
	supportsListing: boolean
	// Custom command builder if needed
	customCommand?: (metadataName: string, cwd: string) => string
	// Description for error messages
	description: string
}

/**
 * Configuration for supported Salesforce metadata types
 */
const METADATA_TYPE_CONFIG: Record<string, MetadataTypeConfig> = {
	ApexClass: {
		cliType: "ApexClass",
		supportsListing: true,
		description: "Apex Class",
	},
	ApexTrigger: {
		cliType: "ApexTrigger",
		supportsListing: true,
		description: "Apex Trigger",
	},
	CustomObject: {
		cliType: "CustomObject",
		supportsListing: true,
		description: "Custom Object",
	},
	CustomField: {
		cliType: "CustomField",
		supportsListing: true,
		description: "Custom Field",
	},
	LightningComponentBundle: {
		cliType: "LightningComponentBundle",
		supportsListing: true,
		description: "Lightning Web Component",
	},
	AuraDefinitionBundle: {
		cliType: "AuraDefinitionBundle",
		supportsListing: true,
		description: "Aura Component",
	},
	FlexiPage: {
		cliType: "FlexiPage",
		supportsListing: true,
		description: "Lightning Page",
	},
	Flow: {
		cliType: "Flow",
		supportsListing: true,
		description: "Flow",
	},
	PermissionSet: {
		cliType: "PermissionSet",
		supportsListing: true,
		description: "Permission Set",
	},
	Profile: {
		cliType: "Profile",
		supportsListing: true,
		description: "Profile",
	},
	Layout: {
		cliType: "Layout",
		supportsListing: true,
		description: "Page Layout",
	},
	ApexPage: {
		cliType: "ApexPage",
		supportsListing: true,
		description: "Visualforce Page",
	},
	ApexComponent: {
		cliType: "ApexComponent",
		supportsListing: true,
		description: "Visualforce Component",
	},
	StaticResource: {
		cliType: "StaticResource",
		supportsListing: true,
		description: "Static Resource",
	},
	CustomTab: {
		cliType: "CustomTab",
		supportsListing: true,
		description: "Custom Tab",
	},
	CustomApplication: {
		cliType: "CustomApplication",
		supportsListing: true,
		description: "Custom Application",
	},
	StandardValueSet: {
		cliType: "StandardValueSet",
		supportsListing: true,
		description: "Standard Value Set",
	},
	GlobalValueSet: {
		cliType: "GlobalValueSet",
		supportsListing: true,
		description: "Global Value Set",
	},
	RecordType: {
		cliType: "RecordType",
		supportsListing: true,
		description: "Record Type",
	},
	ValidationRule: {
		cliType: "ValidationRule",
		supportsListing: true,
		description: "Validation Rule",
	},
	Role: {
		cliType: "Role",
		supportsListing: true,
		description: "Role",
	},
	AssignmentRule: {
		cliType: "AssignmentRule",
		supportsListing: true,
		description: "Assignment Rule",
	},
	AssignmentRules: {
		cliType: "AssignmentRules",
		supportsListing: true,
		description: "Assignment Rules",
	},
	PathAssistant: {
		cliType: "PathAssistant",
		supportsListing: true,
		description: "Path Assistant (Sales Path)",
	},
	PathAssistantSettings: {
		cliType: "PathAssistantSettings",
		supportsListing: true,
		description: "Path Assistant Settings",
	},
}

/**
 * Build the SF CLI command based on metadata type and name
 */
function buildSfCommand(metadataType: string, metadataName: string | undefined, cwd: string): string {
	const config = METADATA_TYPE_CONFIG[metadataType]

	if (!config) {
		throw new Error(
			`Unsupported metadata type: ${metadataType}. Supported types: ${Object.keys(METADATA_TYPE_CONFIG).join(", ")}`,
		)
	}

	// If custom command builder exists, use it
	if (config.customCommand && metadataName) {
		return config.customCommand(metadataName, cwd)
	}

	// If no metadata name provided, list all metadata of that type
	if (!metadataName) {
		if (!config.supportsListing) {
			throw new Error(
				`Metadata type ${metadataType} does not support listing all components. Please provide a metadata_name.`,
			)
		}
		return `sf project retrieve start --metadata "${config.cliType}:*" --json`
	}

	// Retrieve specific metadata component
	return `sf project retrieve start --metadata "${config.cliType}:${metadataName}" --json`
}

/**
 * Parse and format the SF CLI output
 */
function formatSfOutput(output: string, metadataType: string, metadataName: string | undefined): string {
	try {
		const jsonOutput = JSON.parse(output)

		if (jsonOutput.status === 0) {
			const result = jsonOutput.result

			if (!metadataName) {
				// Listing mode - show count and status only to reduce context size
				const files = result?.files || []
				if (files.length === 0) {
					return `No ${metadataType} metadata found in the org.`
				}

				return `Successfully retrieved ${files.length} ${metadataType} component(s). Files have been retrieved to your local project directory.`
			}

			// Specific component retrieval
			const files = result?.files || []
			if (files.length === 0) {
				return `${metadataType} '${metadataName}' was retrieved but no files were found. The component may not exist in the org.`
			}

			return `Successfully retrieved ${metadataType} '${metadataName}'\nThe metadata has been saved to your local project directory. You can now read the files to inspect the metadata content.`
		} else {
			// Error in SF CLI response
			const errorMessage = jsonOutput.message || jsonOutput.result?.message || "Unknown error occurred"
			const errorName = jsonOutput.name || "SfError"
			return `SF CLI Error (${errorName}): ${errorMessage}`
		}
	} catch (parseError) {
		// If JSON parsing fails, return raw output
		if (output.includes("ERROR") || output.includes("error")) {
			return `SF CLI Error:\n${output}`
		}
		return `SF CLI Output:\n${output}`
	}
}

export async function retrieveSfMetadataTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const metadataType: string | undefined = block.params.metadata_type
	const metadataName: string | undefined = block.params.metadata_name

	try {
		if (block.partial) {
			// Show partial state while streaming
			const partialMessage = removeClosingTag("metadata_type", metadataType)
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "retrieveSfMetadata",
						metadataType: partialMessage,
						metadataName: removeClosingTag("metadata_name", metadataName),
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		// Validate required parameters
		if (!metadataType) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("retrieve_sf_metadata")
			pushToolResult(await cline.sayAndCreateMissingParamError("retrieve_sf_metadata", "metadata_type"))
			return
		}

		// Reset mistake count on valid input
		cline.consecutiveMistakeCount = 0

		// Build the SF CLI command
		let command: string
		try {
			command = buildSfCommand(metadataType, metadataName, cline.cwd)
		} catch (error) {
			pushToolResult(formatResponse.toolError(error.message))
			return
		}

		// Create approval message
		const approvalMessage = metadataName
			? `Retrieve ${metadataType}: ${metadataName}`
			: `List all ${metadataType} metadata`

		// Ask for approval
		const toolMessage = JSON.stringify({
			tool: "retrieveSfMetadata",
			metadataType,
			metadataName: metadataName || "(all)",
			command,
		})

		const didApprove = await askApproval("tool", toolMessage)

		if (!didApprove) {
			return
		}

		// Execute the SF CLI command
		try {
			// Execute command synchronously with timeout
			const output = execSync(command, {
				cwd: cline.cwd,
				encoding: "utf-8",
				timeout: 120000, // 2 minute timeout
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer
				stdio: ["pipe", "pipe", "pipe"],
			})

			// Format and return the result
			const formattedResult = formatSfOutput(output, metadataType, metadataName)
			cline.say("completion_result", `Retrieved ${metadataType} metadata successfully. ${formattedResult}`)
			pushToolResult(formattedResult)
		} catch (execError: any) {
			// Handle execution errors
			let errorMessage = "Failed to execute SF CLI command"

			if (execError.killed) {
				errorMessage = "Command timed out after 2 minutes"
			} else if (execError.stderr) {
				errorMessage = execError.stderr
			} else if (execError.stdout) {
				// Sometimes SF CLI returns error info in stdout with non-zero exit
				const formattedResult = formatSfOutput(execError.stdout, metadataType, metadataName)
				cline.say("error", `Retrieved ${metadataType} metadata successfully, Result:${formattedResult}`)
				pushToolResult(formattedResult)
				return
			} else if (execError.message) {
				errorMessage = execError.message
			}

			// Check for common SF CLI issues
			if (errorMessage.includes("command not found") || errorMessage.includes("'sf' is not recognized")) {
				errorMessage =
					"Salesforce CLI (sf) is not installed or not in PATH. Please install it from https://developer.salesforce.com/tools/salesforcecli"
			} else if (errorMessage.includes("No default org set") || errorMessage.includes("No default username")) {
				errorMessage =
					"No default Salesforce org is set. Please run 'sf org login web' or 'sf config set target-org <username>' to set a default org."
			} else if (errorMessage.includes("ENOENT")) {
				errorMessage =
					"Salesforce CLI (sf) is not installed. Please install it from https://developer.salesforce.com/tools/salesforcecli"
			}
			cline.say("error", formatResponse.toolError(`SF CLI Error: ${errorMessage}`))
			pushToolResult(formatResponse.toolError(`SF CLI Error: ${errorMessage}`))
		}
	} catch (error) {
		await handleError("retrieving Salesforce metadata", error)
	}
}
