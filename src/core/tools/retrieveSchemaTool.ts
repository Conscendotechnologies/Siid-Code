import * as path from "path"
import * as fs from "fs/promises"
import * as vscode from "vscode"

import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { getProjectRooDirectoryForCwd, fileExists } from "../../services/roo-config"

/**
 * Schema file configuration
 */
interface SchemaFileConfig {
	fileName: string
	description: string
}

/**
 * Available schema files (without hardcoded paths)
 */
const SCHEMA_FILES: Record<string, SchemaFileConfig> = {
	metadata: {
		fileName: "metadata.xml",
		description: "Salesforce Metadata API v65.0",
	},
	apex: {
		fileName: "apex.xml",
		description: "Salesforce Apex API v65.0",
	},
}

/**
 * Get the path to a schema file
 * Checks in order:
 * 1. Project-local .roo/rules-flow-builder/ (for development)
 * 2. Global storage instructions/modes/flow-builder/ (for packaged extension)
 */
async function getSchemaFilePath(cwd: string, fileName: string, globalStoragePath?: string): Promise<string | null> {
	// Try project-local .roo directory first
	const projectLocalPath = path.join(getProjectRooDirectoryForCwd(cwd), "rules-flow-builder", fileName)
	if (await fileExists(projectLocalPath)) {
		return projectLocalPath
	}

	// Try global storage (for packaged extension)
	// Use the provided globalStoragePath if available, otherwise try to get it from extension context
	if (globalStoragePath) {
		const globalPath = path.join(globalStoragePath, "instructions", "modes", "flow-builder", fileName)
		if (await fileExists(globalPath)) {
			return globalPath
		}
	}

	return null
}

/**
 * Search for a component definition in XML content
 * Searches for complexType, simpleType, element, message, and operation definitions
 */
function searchComponentInXml(xmlContent: string, componentName: string): string | null {
	// Patterns to search for different component types
	const patterns = [
		// complexType: <xsd:complexType name="ComponentName">...</xsd:complexType>
		{
			type: "complexType",
			start: new RegExp(`<xsd:complexType\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/xsd:complexType>/,
			selfClosing: false,
		},
		// simpleType: <xsd:simpleType name="ComponentName">...</xsd:simpleType>
		{
			type: "simpleType",
			start: new RegExp(`<xsd:simpleType\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/xsd:simpleType>/,
			selfClosing: false,
		},
		// element: <xsd:element name="componentName">...</xsd:element> or <xsd:element name="componentName" ... />
		{
			type: "element",
			start: new RegExp(`<xsd:element\\s+name="${componentName}"[^>]*`, "i"),
			end: /<\/xsd:element>/,
			selfClosing: true,
		},
		// message: <message name="componentName">...</message>
		{
			type: "message",
			start: new RegExp(`<message\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/message>/,
			selfClosing: false,
		},
		// operation: <operation name="componentName">...</operation>
		{
			type: "operation",
			start: new RegExp(`<operation\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/operation>/,
			selfClosing: false,
		},
	]

	// Try each pattern
	for (const pattern of patterns) {
		const startMatch = xmlContent.match(pattern.start)
		if (startMatch) {
			const startIndex = startMatch.index!
			const contentFromStart = xmlContent.substring(startIndex)

			// Check if it's a self-closing element
			if (pattern.selfClosing) {
				const selfClosingMatch = contentFromStart.match(/^[^>]*\/>/)
				if (selfClosingMatch) {
					const endIndex = startIndex + selfClosingMatch[0].length
					const definition = xmlContent.substring(startIndex, endIndex)
					return definition
				}
			}

			// Find the matching closing tag
			const endMatch = contentFromStart.match(pattern.end)
			if (endMatch) {
				const endIndex = startIndex + endMatch.index! + endMatch[0].length
				const definition = xmlContent.substring(startIndex, endIndex)
				return definition
			}
		}
	}

	return null
}

/**
 * Search for related types referenced in the component definition
 */
function findRelatedTypes(definition: string): string[] {
	const relatedTypes: Set<string> = new Set()

	// Find all type references: type="tns:TypeName"
	const typeRefs = definition.matchAll(/type="tns:([^"]+)"/g)
	for (const match of typeRefs) {
		relatedTypes.add(match[1])
	}

	// Find all element references with ref: ref="tns:ElementName"
	const refRefs = definition.matchAll(/ref="tns:([^"]+)"/g)
	for (const match of refRefs) {
		relatedTypes.add(match[1])
	}

	return Array.from(relatedTypes)
}

/**
 * Format the schema output with related types
 */
function formatSchemaOutput(
	componentName: string,
	definition: string,
	schemaFile: string,
	relatedTypes: string[],
): string {
	let output = `Schema definition for '${componentName}' from ${SCHEMA_FILES[schemaFile].description}:\n\n`
	output += `\`\`\`xml\n${definition}\n\`\`\`\n`

	if (relatedTypes.length > 0) {
		output += `\n\nReferenced types in this definition: ${relatedTypes.join(", ")}`
		output += `\n\nTo retrieve any of these related types, use the retrieve_schema tool with the type name.`
	}

	return output
}

/**
 * Search for a component in a specific schema file
 */
export async function searchInSchemaFile(
	cwd: string,
	componentName: string,
	schemaKey: string,
	globalStoragePath?: string,
): Promise<{ found: boolean; definition?: string; relatedTypes?: string[] }> {
	const schemaConfig = SCHEMA_FILES[schemaKey]

	// Get the file path (tries project-local first, then global storage)
	const filePath = await getSchemaFilePath(cwd, schemaConfig.fileName, globalStoragePath)

	if (!filePath) {
		throw new Error(
			`Schema file not found: ${schemaConfig.fileName}\n` +
				`The file should be in either:\n` +
				`  1. Project: <workspace>/.roo/rules-flow-builder/${schemaConfig.fileName}\n` +
				`  2. Global: <vscode-storage>/instructions/modes/flow-builder/${schemaConfig.fileName}\n\n` +
				`Please ensure the extension is properly installed or the schema files are present.`,
		)
	}

	try {
		// Read the file content
		const content = await fs.readFile(filePath, "utf-8")

		// Search for the component
		const definition = searchComponentInXml(content, componentName)

		if (definition) {
			const relatedTypes = findRelatedTypes(definition)
			return { found: true, definition, relatedTypes }
		}

		return { found: false }
	} catch (error) {
		// File can't be read
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Schema file not accessible: ${filePath}\n` + `Please ensure you have read permissions for this file.`,
			)
		}
		throw error
	}
}

export async function retrieveSchemaTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const componentName: string | undefined = block.params.component_name
	const schemaFile: string | undefined = block.params.schema_file || "metadata"

	try {
		if (block.partial) {
			// Show partial state while streaming
			const partialMessage = removeClosingTag("component_name", componentName)
			await cline
				.ask(
					"tool",
					JSON.stringify({
						tool: "retrieveSchema",
						componentName: partialMessage,
						schemaFile: removeClosingTag("schema_file", schemaFile),
					}),
					block.partial,
				)
				.catch(() => {})
			return
		}

		// Validate required parameters
		if (!componentName) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("retrieve_schema")
			pushToolResult(await cline.sayAndCreateMissingParamError("retrieve_schema", "component_name"))
			return
		}

		// Validate schema_file parameter
		const validSchemaFiles = ["metadata", "apex", "both"]
		if (schemaFile && !validSchemaFiles.includes(schemaFile)) {
			cline.consecutiveMistakeCount++
			cline.recordToolError("retrieve_schema")
			pushToolResult(
				formatResponse.toolError(
					`Invalid schema_file parameter: ${schemaFile}. Valid options: ${validSchemaFiles.join(", ")}`,
				),
			)
			return
		}

		// Reset mistake count on valid input
		cline.consecutiveMistakeCount = 0

		// Get global storage path from the task
		const globalStoragePath = (cline as any).globalStoragePath

		// Search for the component
		let result: { found: boolean; definition?: string; relatedTypes?: string[]; schemaKey?: string } = {
			found: false,
		}

		if (schemaFile === "both") {
			// Search in both files
			for (const key of ["metadata", "apex"]) {
				try {
					const searchResult = await searchInSchemaFile(cline.cwd, componentName, key, globalStoragePath)
					if (searchResult.found) {
						result = { ...searchResult, schemaKey: key }
						break
					}
				} catch (error) {
					// If one file fails, continue to the next
					if ((error as Error).message.includes("not found")) {
						continue
					}
					throw error
				}
			}
		} else {
			// Search in specific file
			const searchResult = await searchInSchemaFile(cline.cwd, componentName, schemaFile, globalStoragePath)
			result = { ...searchResult, schemaKey: schemaFile }
		}

		// Return the result
		if (result.found && result.definition && result.schemaKey) {
			const output = formatSchemaOutput(
				componentName,
				result.definition,
				result.schemaKey,
				result.relatedTypes || [],
			)
			pushToolResult(output)
		} else {
			const searchedFiles =
				schemaFile === "both"
					? "both metadata.xml and apex.xml"
					: `${SCHEMA_FILES[schemaFile].fileName} (${SCHEMA_FILES[schemaFile].description})`

			pushToolResult(
				formatResponse.toolError(
					`Component '${componentName}' not found in ${searchedFiles}.\n\n` +
						`The component may not exist or may be spelled differently. ` +
						`Try checking the XML files directly or searching with a different name.`,
				),
			)
		}
	} catch (error) {
		await handleError("retrieving XML schema", error)
	}
}
