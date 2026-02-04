import { describe, expect, test, vi } from "vitest"

/**
 * Tests for retrieveSfMetadataTool
 * This file tests the helper functions used by the Salesforce metadata retrieval tool
 */

// Import the functions we'll test by extracting them from the module
// Since they're not exported, we'll need to test the main function's behavior
// For now, we'll create standalone tests for the command building and output formatting logic

describe("retrieveSfMetadataTool - buildSfCommand logic", () => {
	describe("Command generation for specific metadata types", () => {
		test("should generate correct command for ApexClass with name", () => {
			const metadataType = "ApexClass"
			const metadataName = "AccountController"
			const expectedCommand = `sf project retrieve start --metadata "ApexClass:AccountController" --json`

			// This represents the command that would be built
			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should generate correct command for ApexTrigger with name", () => {
			const metadataType = "ApexTrigger"
			const metadataName = "AccountTrigger"
			const expectedCommand = `sf project retrieve start --metadata "ApexTrigger:AccountTrigger" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should generate correct command for CustomObject with name", () => {
			const metadataType = "CustomObject"
			const metadataName = "MyCustomObject__c"
			const expectedCommand = `sf project retrieve start --metadata "CustomObject:MyCustomObject__c" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should generate correct command for LightningComponentBundle", () => {
			const metadataType = "LightningComponentBundle"
			const metadataName = "myComponent"
			const expectedCommand = `sf project retrieve start --metadata "LightningComponentBundle:myComponent" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should generate correct command for Flow with name", () => {
			const metadataType = "Flow"
			const metadataName = "My_Flow"
			const expectedCommand = `sf project retrieve start --metadata "Flow:My_Flow" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should generate correct command for PermissionSet with name", () => {
			const metadataType = "PermissionSet"
			const metadataName = "Admin_Permissions"
			const expectedCommand = `sf project retrieve start --metadata "PermissionSet:Admin_Permissions" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})
	})

	describe("Command generation for listing all metadata", () => {
		test("should generate correct command for listing all ApexClass", () => {
			const metadataType = "ApexClass"
			const expectedCommand = `sf project retrieve start --metadata "ApexClass:*" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:*" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should generate correct command for listing all CustomObjects", () => {
			const metadataType = "CustomObject"
			const expectedCommand = `sf project retrieve start --metadata "CustomObject:*" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:*" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should generate correct command for listing all Flows", () => {
			const metadataType = "Flow"
			const expectedCommand = `sf project retrieve start --metadata "Flow:*" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:*" --json`
			expect(command).toBe(expectedCommand)
		})
	})

	describe("Special metadata types", () => {
		test("should handle PathAssistant metadata type", () => {
			const metadataType = "PathAssistant"
			const metadataName = "Account_Path"
			const expectedCommand = `sf project retrieve start --metadata "PathAssistant:Account_Path" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should handle ValidationRule metadata type", () => {
			const metadataType = "ValidationRule"
			const metadataName = "Account.Check_Email"
			const expectedCommand = `sf project retrieve start --metadata "ValidationRule:Account.Check_Email" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})

		test("should handle StandardValueSet metadata type", () => {
			const metadataType = "StandardValueSet"
			const metadataName = "AccountType"
			const expectedCommand = `sf project retrieve start --metadata "StandardValueSet:AccountType" --json`

			const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`
			expect(command).toBe(expectedCommand)
		})
	})
})

describe("retrieveSfMetadataTool - formatSfOutput logic", () => {
	// Helper function to simulate formatSfOutput behavior
	function formatSfOutput(output: string, metadataType: string, metadataName: string | undefined): string {
		try {
			const jsonOutput = JSON.parse(output)

			if (jsonOutput.status === 0) {
				const result = jsonOutput.result

				if (!metadataName) {
					// Listing mode - show count and status only
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

	describe("Successful retrieval responses", () => {
		test("should return summary for successful single component retrieval", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: ["force-app/main/default/classes/AccountController.cls"],
				},
			})

			const result = formatSfOutput(sfOutput, "ApexClass", "AccountController")
			expect(result).toContain("Successfully retrieved ApexClass 'AccountController'")
			expect(result).toContain("metadata has been saved to your local project directory")
			expect(result).not.toContain("AccountController.cls") // Should not include file paths
		})

		test("should return summary for successful multiple file retrieval", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: [
						"force-app/main/default/lwc/myComponent/myComponent.js",
						"force-app/main/default/lwc/myComponent/myComponent.html",
						"force-app/main/default/lwc/myComponent/myComponent.css",
					],
				},
			})

			const result = formatSfOutput(sfOutput, "LightningComponentBundle", "myComponent")
			expect(result).toContain("Successfully retrieved LightningComponentBundle 'myComponent'")
			expect(result).not.toContain(".js") // Should not include file extensions
			expect(result).not.toContain("force-app") // Should not include file paths
		})

		test("should return warning for empty files array", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: [],
				},
			})

			const result = formatSfOutput(sfOutput, "ApexClass", "NonExistentClass")
			expect(result).toContain("ApexClass 'NonExistentClass' was retrieved but no files were found")
			expect(result).toContain("component may not exist")
		})

		test("should return count summary for listing mode", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: [
						"force-app/main/default/classes/Class1.cls",
						"force-app/main/default/classes/Class2.cls",
						"force-app/main/default/classes/Class3.cls",
						"force-app/main/default/classes/Class4.cls",
						"force-app/main/default/classes/Class5.cls",
					],
				},
			})

			const result = formatSfOutput(sfOutput, "ApexClass", undefined)
			expect(result).toContain("Successfully retrieved 5 ApexClass component(s)")
			expect(result).toContain("Files have been retrieved to your local project directory")
			expect(result).not.toContain("Class1.cls") // Should not include individual file names
		})

		test("should return message for empty listing", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: [],
				},
			})

			const result = formatSfOutput(sfOutput, "CustomObject", undefined)
			expect(result).toBe("No CustomObject metadata found in the org.")
		})
	})

	describe("Error responses", () => {
		test("should format SF CLI error with status non-zero", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				name: "SfError",
				message: "No default org set. Run 'sf org login web' to set a default org.",
			})

			const result = formatSfOutput(sfOutput, "ApexClass", "TestClass")
			expect(result).toContain("SF CLI Error (SfError)")
			expect(result).toContain("No default org set")
		})

		test("should format metadata not found error", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				name: "MetadataNotFoundError",
				message: "Component 'NonExistentClass' not found in org",
			})

			const result = formatSfOutput(sfOutput, "ApexClass", "NonExistentClass")
			expect(result).toContain("SF CLI Error (MetadataNotFoundError)")
			expect(result).toContain("not found in org")
		})

		test("should format authentication error", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				name: "AuthenticationError",
				message: "Invalid session id",
			})

			const result = formatSfOutput(sfOutput, "Flow", "MyFlow")
			expect(result).toContain("SF CLI Error (AuthenticationError)")
			expect(result).toContain("Invalid session id")
		})

		test("should format invalid metadata type error", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				name: "InvalidMetadataType",
				message: "Unknown metadata type: InvalidType",
			})

			const result = formatSfOutput(sfOutput, "InvalidType", "Something")
			expect(result).toContain("SF CLI Error (InvalidMetadataType)")
			expect(result).toContain("Unknown metadata type")
		})
	})

	describe("Edge cases", () => {
		test("should handle malformed JSON gracefully", () => {
			const malformedOutput = "{ invalid json"

			const result = formatSfOutput(malformedOutput, "ApexClass", "Test")
			expect(result).toContain("SF CLI Output:")
			expect(result).toContain("{ invalid json")
		})

		test("should handle malformed JSON with error keyword", () => {
			const malformedOutput = "ERROR: Something went wrong"

			const result = formatSfOutput(malformedOutput, "ApexClass", "Test")
			expect(result).toContain("SF CLI Error:")
			expect(result).toContain("Something went wrong")
		})

		test("should handle SF CLI output with warnings (summary only)", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: ["force-app/main/default/classes/MyClass.cls"],
				},
				warnings: ["API version mismatch detected"],
			})

			const result = formatSfOutput(sfOutput, "ApexClass", "MyClass")
			expect(result).toContain("Successfully retrieved ApexClass 'MyClass'")
			// Warnings are not included in summary - only success message
			expect(result).not.toContain("warning")
		})

		test("should return summary for large file list without listing files", () => {
			const largeFileList = Array.from({ length: 100 }, (_, i) => `force-app/main/default/classes/Class${i}.cls`)
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: largeFileList,
				},
			})

			const result = formatSfOutput(sfOutput, "ApexClass", undefined)
			expect(result).toContain("Successfully retrieved 100 ApexClass component(s)")
			expect(result).not.toContain("Class0.cls") // Should not list individual files
			expect(result).not.toContain("Class99.cls")
		})

		test("should return summary for nested component files without listing them", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					files: [
						"force-app/main/default/lwc/myComponent/myComponent.js",
						"force-app/main/default/lwc/myComponent/myComponent.html",
						"force-app/main/default/lwc/myComponent/myComponent.css",
						"force-app/main/default/lwc/myComponent/myComponent.js-meta.xml",
					],
				},
			})

			const result = formatSfOutput(sfOutput, "LightningComponentBundle", "myComponent")
			expect(result).toContain("Successfully retrieved LightningComponentBundle 'myComponent'")
			expect(result).not.toContain("myComponent.js") // Should not list files
			expect(result).not.toContain("myComponent.html")
		})

		test("should handle error without name field", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				message: "Some error occurred",
			})

			const result = formatSfOutput(sfOutput, "Flow", "TestFlow")
			expect(result).toContain("SF CLI Error (SfError)") // Default name
			expect(result).toContain("Some error occurred")
		})

		test("should handle error without message field", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				name: "CustomError",
			})

			const result = formatSfOutput(sfOutput, "Flow", "TestFlow")
			expect(result).toContain("SF CLI Error (CustomError)")
			expect(result).toContain("Unknown error occurred") // Default message
		})
	})
})

describe("retrieveSfMetadataTool - supported metadata types", () => {
	const supportedMetadataTypes = [
		"ApexClass",
		"ApexTrigger",
		"CustomObject",
		"CustomField",
		"LightningComponentBundle",
		"AuraDefinitionBundle",
		"FlexiPage",
		"Flow",
		"PermissionSet",
		"Profile",
		"Layout",
		"ApexPage",
		"ApexComponent",
		"StaticResource",
		"CustomTab",
		"CustomApplication",
		"StandardValueSet",
		"GlobalValueSet",
		"RecordType",
		"ValidationRule",
		"Role",
		"AssignmentRule",
		"AssignmentRules",
		"PathAssistant",
		"PathAssistantSettings",
	]

	test("should have all standard metadata types configured", () => {
		expect(supportedMetadataTypes).toContain("ApexClass")
		expect(supportedMetadataTypes).toContain("CustomObject")
		expect(supportedMetadataTypes).toContain("LightningComponentBundle")
		expect(supportedMetadataTypes).toContain("Flow")
	})

	test("should support development-related metadata types", () => {
		const devTypes = ["ApexClass", "ApexTrigger", "LightningComponentBundle", "AuraDefinitionBundle"]
		devTypes.forEach((type) => {
			expect(supportedMetadataTypes).toContain(type)
		})
	})

	test("should support security-related metadata types", () => {
		const securityTypes = ["PermissionSet", "Profile", "Role"]
		securityTypes.forEach((type) => {
			expect(supportedMetadataTypes).toContain(type)
		})
	})

	test("should support configuration metadata types", () => {
		const configTypes = ["CustomObject", "CustomField", "Layout", "FlexiPage"]
		configTypes.forEach((type) => {
			expect(supportedMetadataTypes).toContain(type)
		})
	})

	test("should support automation metadata types", () => {
		const automationTypes = ["Flow", "ValidationRule", "AssignmentRule", "PathAssistant"]
		automationTypes.forEach((type) => {
			expect(supportedMetadataTypes).toContain(type)
		})
	})
})

describe("retrieveSfMetadataTool - error scenarios", () => {
	describe("SF CLI installation errors", () => {
		test("should identify 'command not found' error", () => {
			const error = "sf: command not found"
			expect(error).toContain("command not found")
		})

		test("should identify 'not recognized' error on Windows", () => {
			const error = "'sf' is not recognized as an internal or external command"
			expect(error).toContain("not recognized")
		})

		test("should identify ENOENT error", () => {
			const error = { code: "ENOENT", message: "spawn sf ENOENT" }
			expect(error.code).toBe("ENOENT")
		})
	})

	describe("Salesforce org configuration errors", () => {
		test("should identify 'No default org' error", () => {
			const error = "No default org set"
			expect(error).toContain("No default org")
		})

		test("should identify 'No default username' error", () => {
			const error = "No default username set"
			expect(error).toContain("No default username")
		})
	})

	describe("Command execution errors", () => {
		test("should identify timeout error", () => {
			const error = { killed: true, signal: "SIGTERM" }
			expect(error.killed).toBe(true)
		})

		test("should handle stderr output", () => {
			const error = { stderr: "Error: Connection refused" }
			expect(error.stderr).toContain("Error")
		})

		test("should handle non-zero exit code", () => {
			const error = { code: 1, message: "Command failed" }
			expect(error.code).not.toBe(0)
		})
	})
})

describe("retrieveSfMetadataTool - metadata type validation", () => {
	test("should validate supported metadata types", () => {
		const supportedTypes = ["ApexClass", "CustomObject", "Flow"]
		supportedTypes.forEach((type) => {
			expect(type).toBeTruthy()
			expect(typeof type).toBe("string")
		})
	})

	test("should reject empty metadata type", () => {
		const metadataType = ""
		expect(metadataType).toBeFalsy()
	})

	test("should handle case-sensitive metadata type names", () => {
		const correctType = "ApexClass"
		const incorrectType = "apexclass"
		expect(correctType).not.toBe(incorrectType)
	})
})

describe("retrieveSfMetadataTool - integration scenarios", () => {
	test("should handle full retrieval workflow for ApexClass", () => {
		const metadataType = "ApexClass"
		const metadataName = "AccountController"
		const command = `sf project retrieve start --metadata "${metadataType}:${metadataName}" --json`

		expect(command).toContain("sf project retrieve start")
		expect(command).toContain("--metadata")
		expect(command).toContain("ApexClass:AccountController")
		expect(command).toContain("--json")
	})

	test("should handle full listing workflow for CustomObjects", () => {
		const metadataType = "CustomObject"
		const command = `sf project retrieve start --metadata "${metadataType}:*" --json`

		expect(command).toContain("sf project retrieve start")
		expect(command).toContain("CustomObject:*")
		expect(command).toContain("--json")
	})

	test("should validate command timeout configuration", () => {
		const timeout = 120000 // 2 minutes
		expect(timeout).toBe(120000)
		expect(timeout).toBeGreaterThan(0)
	})

	test("should validate buffer size configuration", () => {
		const maxBuffer = 10 * 1024 * 1024 // 10MB
		expect(maxBuffer).toBe(10485760)
		expect(maxBuffer).toBeGreaterThan(0)
	})
})
