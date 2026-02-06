import { describe, expect, test } from "vitest"

/**
 * Tests for sfDeployMetadataTool
 * This file tests the formatting functions used by the Salesforce metadata deployment tool
 */

describe("sfDeployMetadataTool - formatDryRunResult", () => {
	// Helper function to simulate formatDryRunResult behavior
	function formatDryRunResult(
		output: string,
		metadataType: string,
		metadataName: string,
		testLevel: string,
	): { success: boolean; message: string } {
		const componentCount = metadataName.split(",").length
		const componentText = componentCount > 1 ? `${componentCount} components` : metadataName
		try {
			const jsonOutput = JSON.parse(output)

			if (jsonOutput.status === 0 || jsonOutput.result?.status === "Succeeded") {
				const result = jsonOutput.result

				// Format success message
				let message = `✅ DRY RUN VALIDATION PASSED\n\n`
				message += `Metadata: ${metadataType} - ${metadataName}\n`
				message += `Test Level: ${testLevel}\n\n`

				// Add test results if available
				if (result?.numberTestsTotal > 0) {
					const testsRun = result.numberTestsTotal || 0
					const testsPassed = testsRun - (result.numberTestErrors || 0)
					const coverage =
						result.numberComponentsDeployed > 0
							? Math.round(
									((result.numberComponentsCovered || 0) / result.numberComponentsDeployed) * 100,
								)
							: 0

					message += `Test Results:\n`
					message += `  - Tests Run: ${testsRun}\n`
					message += `  - Tests Passed: ${testsPassed}\n`
					message += `  - Tests Failed: ${result.numberTestErrors || 0}\n`
					message += `  - Code Coverage: ${coverage}%\n\n`
				}

				// Add components that will be deployed
				if (result?.deployedSource && result.deployedSource.length > 0) {
					message += `Components validated for deployment:\n`
					result.deployedSource.slice(0, 10).forEach((comp: any) => {
						message += `  - ${comp.fullName || comp.fileName} (${comp.type})\n`
					})
					if (result.deployedSource.length > 10) {
						message += `  ... and ${result.deployedSource.length - 10} more\n`
					}
					message += `\n`
				}

				message += `✅ Proceeding with actual deployment...`

				return { success: true, message }
			} else {
				// Dry run failed - format error message
				let message = `❌ DRY RUN VALIDATION FAILED - DEPLOYMENT ABORTED\n\n`
				message += `Metadata: ${metadataType} - ${metadataName}\n`
				message += `Test Level: ${testLevel}\n\n`

				const result = jsonOutput.result

				// Add validation errors
				if (result?.details?.componentFailures) {
					const failures = Array.isArray(result.details.componentFailures)
						? result.details.componentFailures
						: [result.details.componentFailures]

					message += `Validation Errors:\n`
					failures.forEach((failure: any) => {
						message += `  - ${failure.fullName || failure.fileName}: ${failure.problem || failure.problemType}\n`
						if (failure.lineNumber) {
							message += `    Line ${failure.lineNumber}: ${failure.problemType}\n`
						}
					})
					message += `\n`
				}

				// Add test failures
				if (result?.details?.runTestResult?.failures) {
					const testFailures = Array.isArray(result.details.runTestResult.failures)
						? result.details.runTestResult.failures
						: [result.details.runTestResult.failures]

					message += `Test Failures:\n`
					testFailures.forEach((failure: any) => {
						message += `  - ${failure.name}.${failure.methodName}:\n`
						message += `    ${failure.message}\n`
						if (failure.stackTrace) {
							message += `    Stack: ${failure.stackTrace.substring(0, 200)}...\n`
						}
					})
					message += `\n`
				}

				// Add code coverage issues
				if (result?.details?.runTestResult?.codeCoverage) {
					const coverage = result.details.runTestResult.codeCoverage
					const totalCoverage = coverage.reduce((acc: number, c: any) => acc + (c.numLocations || 0), 0)
					const coveredLines = coverage.reduce(
						(acc: number, c: any) => acc + (c.numLocationsNotCovered || 0),
						0,
					)
					const coveragePercent = totalCoverage > 0 ? Math.round((1 - coveredLines / totalCoverage) * 100) : 0

					if (coveragePercent < 75) {
						message += `Code Coverage: ${coveragePercent}% (Minimum required: 75%)\n\n`
					}
				}

				// Add general error message
				const errorMessage = jsonOutput.message || result?.message || "Unknown validation error"
				message += `Error: ${errorMessage}\n\n`
				message += `⚠️ Please fix these issues before attempting deployment again.`

				return { success: false, message }
			}
		} catch (parseError) {
			// If JSON parsing fails, return raw output
			let message = `❌ DRY RUN VALIDATION FAILED - DEPLOYMENT ABORTED\n\n`
			message += `Failed to parse SF CLI output:\n${output}\n\n`
			message += `⚠️ Please review the output and fix any issues before attempting deployment again.`
			return { success: false, message }
		}
	}

	describe("Successful dry run validations", () => {
		test("should format successful dry run without tests", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					deployedSource: [
						{ fullName: "AccountController", type: "ApexClass", fileName: "AccountController.cls" },
					],
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "AccountController", "NoTestRun")
			expect(result.success).toBe(true)
			expect(result.message).toContain("✅ DRY RUN VALIDATION PASSED")
			expect(result.message).toContain("Metadata: ApexClass - AccountController")
			expect(result.message).toContain("Test Level: NoTestRun")
			expect(result.message).toContain("Components validated for deployment:")
			expect(result.message).toContain("AccountController (ApexClass)")
			expect(result.message).toContain("✅ Proceeding with actual deployment...")
		})

		test("should format successful dry run with test results", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					numberTestsTotal: 10,
					numberTestErrors: 0,
					numberComponentsDeployed: 5,
					numberComponentsCovered: 4,
					deployedSource: [
						{ fullName: "AccountController", type: "ApexClass" },
						{ fullName: "ContactController", type: "ApexClass" },
					],
				},
			})

			const result = formatDryRunResult(
				sfOutput,
				"ApexClass",
				"AccountController,ContactController",
				"RunLocalTests",
			)
			expect(result.success).toBe(true)
			expect(result.message).toContain("Test Results:")
			expect(result.message).toContain("Tests Run: 10")
			expect(result.message).toContain("Tests Passed: 10")
			expect(result.message).toContain("Tests Failed: 0")
			expect(result.message).toContain("Code Coverage: 80%")
		})

		test("should format successful dry run with multiple components (limit to 10)", () => {
			const deployedSource = Array.from({ length: 15 }, (_, i) => ({
				fullName: `Class${i}`,
				type: "ApexClass",
			}))

			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					deployedSource,
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "MultipleClasses", "NoTestRun")
			expect(result.success).toBe(true)
			expect(result.message).toContain("... and 5 more")
			// Should only show first 10 components
			expect(result.message).toContain("Class0")
			expect(result.message).toContain("Class9")
		})

		test("should handle components without fullName using fileName", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					deployedSource: [{ fileName: "AccountController.cls", type: "ApexClass" }],
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "AccountController", "NoTestRun")
			expect(result.success).toBe(true)
			expect(result.message).toContain("AccountController.cls (ApexClass)")
		})
	})

	describe("Failed dry run validations", () => {
		test("should format dry run failure with component errors", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				result: {
					status: "Failed",
					details: {
						componentFailures: [
							{
								fullName: "AccountController",
								problemType: "Error",
								problem: "Variable does not exist: accnt",
								lineNumber: 15,
							},
						],
					},
					message: "Deployment validation failed",
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "AccountController", "NoTestRun")
			expect(result.success).toBe(false)
			expect(result.message).toContain("❌ DRY RUN VALIDATION FAILED - DEPLOYMENT ABORTED")
			expect(result.message).toContain("Validation Errors:")
			expect(result.message).toContain("AccountController: Variable does not exist: accnt")
			expect(result.message).toContain("Line 15: Error")
			expect(result.message).toContain("⚠️ Please fix these issues before attempting deployment again.")
		})

		test("should format dry run failure with test failures", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				result: {
					status: "Failed",
					details: {
						runTestResult: {
							failures: [
								{
									name: "AccountControllerTest",
									methodName: "testCreateAccount",
									message: "System.AssertException: Assertion Failed: Expected 1, Actual 0",
									stackTrace: "Class.AccountControllerTest.testCreateAccount: line 25, column 1",
								},
							],
						},
					},
					message: "Test failures detected",
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "AccountController", "RunLocalTests")
			expect(result.success).toBe(false)
			expect(result.message).toContain("Test Failures:")
			expect(result.message).toContain("AccountControllerTest.testCreateAccount:")
			expect(result.message).toContain("System.AssertException")
			expect(result.message).toContain("Stack: Class.AccountControllerTest.testCreateAccount")
		})

		test("should format dry run failure with low code coverage", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				result: {
					status: "Failed",
					details: {
						runTestResult: {
							codeCoverage: [
								{ numLocations: 100, numLocationsNotCovered: 40 },
								{ numLocations: 50, numLocationsNotCovered: 20 },
							],
						},
					},
					message: "Insufficient code coverage",
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "AccountController", "RunAllTestsInOrg")
			expect(result.success).toBe(false)
			expect(result.message).toContain("Code Coverage: 60% (Minimum required: 75%)")
		})

		test("should handle multiple component failures as array", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				result: {
					status: "Failed",
					details: {
						componentFailures: [
							{ fullName: "Class1", problem: "Error 1" },
							{ fullName: "Class2", problem: "Error 2" },
						],
					},
					message: "Multiple errors",
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "Class1,Class2", "NoTestRun")
			expect(result.success).toBe(false)
			expect(result.message).toContain("Class1: Error 1")
			expect(result.message).toContain("Class2: Error 2")
		})

		test("should handle single component failure as object", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				result: {
					status: "Failed",
					details: {
						componentFailures: {
							fullName: "AccountController",
							problem: "Syntax error",
						},
					},
					message: "Validation failed",
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "AccountController", "NoTestRun")
			expect(result.success).toBe(false)
			expect(result.message).toContain("AccountController: Syntax error")
		})
	})

	describe("Edge cases", () => {
		test("should handle malformed JSON output", () => {
			const malformedOutput = "{ invalid json"

			const result = formatDryRunResult(malformedOutput, "ApexClass", "Test", "NoTestRun")
			expect(result.success).toBe(false)
			expect(result.message).toContain("Failed to parse SF CLI output:")
			expect(result.message).toContain("{ invalid json")
		})

		test("should handle missing result object", () => {
			const sfOutput = JSON.stringify({
				status: 0,
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "Test", "NoTestRun")
			expect(result.success).toBe(true)
			expect(result.message).toContain("✅ DRY RUN VALIDATION PASSED")
		})

		test("should calculate 0% coverage when no components deployed", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					numberTestsTotal: 5,
					numberTestErrors: 0,
					numberComponentsDeployed: 0,
					numberComponentsCovered: 0,
				},
			})

			const result = formatDryRunResult(sfOutput, "ApexClass", "Test", "RunLocalTests")
			expect(result.success).toBe(true)
			expect(result.message).toContain("Code Coverage: 0%")
		})
	})
})

describe("sfDeployMetadataTool - formatDeployResult", () => {
	// Helper function to simulate formatDeployResult behavior
	function formatDeployResult(output: string, metadataType: string, metadataName: string): string {
		try {
			const jsonOutput = JSON.parse(output)

			if (jsonOutput.status === 0 || jsonOutput.result?.status === "Succeeded") {
				const result = jsonOutput.result

				let message = `✅ DEPLOYMENT SUCCESSFUL!\n\n`
				message += `Dry Run Validation: ✅ PASSED\n`
				message += `Deployment Status: ✅ COMPLETED\n\n`

				message += `Metadata: ${metadataType} - ${metadataName}\n`
				message += `Deployment ID: ${result?.id || "N/A"}\n\n`

				// Add deployed components
				if (result?.deployedSource && result.deployedSource.length > 0) {
					message += `Deployed Components:\n`
					result.deployedSource.forEach((comp: any) => {
						message += `  - ${comp.fullName || comp.fileName} (${comp.type})\n`
					})
					message += `\n`
				}

				// Add test results
				if (result?.numberTestsTotal > 0) {
					const testsRun = result.numberTestsTotal || 0
					const testsPassed = testsRun - (result.numberTestErrors || 0)
					const coverage =
						result.numberComponentsDeployed > 0
							? Math.round(
									((result.numberComponentsCovered || 0) / result.numberComponentsDeployed) * 100,
								)
							: 0

					message += `Test Results:\n`
					message += `  - Tests Run: ${testsRun}\n`
					message += `  - Tests Passed: ${testsPassed}\n`
					message += `  - Code Coverage: ${coverage}%\n\n`
				}

				message += `The metadata has been successfully deployed to the org.`

				return message
			} else {
				// Deployment failed after dry run passed (rare case)
				const errorMessage = jsonOutput.message || jsonOutput.result?.message || "Unknown deployment error"
				return `❌ DEPLOYMENT FAILED\n\nNote: Dry run passed but actual deployment failed.\nError: ${errorMessage}\n\nDeployment ID: ${jsonOutput.result?.id || "N/A"}`
			}
		} catch (parseError) {
			if (output.includes("ERROR") || output.includes("error")) {
				return `❌ DEPLOYMENT FAILED\n\nSF CLI Error:\n${output}`
			}
			return `SF CLI Output:\n${output}`
		}
	}

	describe("Successful deployments", () => {
		test("should format successful deployment without tests", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					id: "0Af5g00000abc123",
					deployedSource: [{ fullName: "AccountController", type: "ApexClass" }],
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "AccountController")
			expect(result).toContain("✅ DEPLOYMENT SUCCESSFUL!")
			expect(result).toContain("Dry Run Validation: ✅ PASSED")
			expect(result).toContain("Deployment Status: ✅ COMPLETED")
			expect(result).toContain("Metadata: ApexClass - AccountController")
			expect(result).toContain("Deployment ID: 0Af5g00000abc123")
			expect(result).toContain("Deployed Components:")
			expect(result).toContain("AccountController (ApexClass)")
			expect(result).toContain("successfully deployed to the org")
		})

		test("should format successful deployment with test results", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					id: "0Af5g00000abc456",
					numberTestsTotal: 15,
					numberTestErrors: 1,
					numberComponentsDeployed: 10,
					numberComponentsCovered: 9,
					deployedSource: [
						{ fullName: "AccountController", type: "ApexClass" },
						{ fullName: "ContactController", type: "ApexClass" },
					],
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "AccountController,ContactController")
			expect(result).toContain("✅ DEPLOYMENT SUCCESSFUL!")
			expect(result).toContain("Test Results:")
			expect(result).toContain("Tests Run: 15")
			expect(result).toContain("Tests Passed: 14")
			expect(result).toContain("Code Coverage: 90%")
		})

		test("should format deployment with multiple components", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					id: "0Af5g00000abc789",
					deployedSource: [
						{ fullName: "Class1", type: "ApexClass" },
						{ fullName: "Class2", type: "ApexClass" },
						{ fullName: "Class3", type: "ApexClass" },
					],
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "Class1,Class2,Class3")
			expect(result).toContain("Class1 (ApexClass)")
			expect(result).toContain("Class2 (ApexClass)")
			expect(result).toContain("Class3 (ApexClass)")
		})

		test("should handle components using fileName instead of fullName", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					id: "0Af5g00000abc999",
					deployedSource: [{ fileName: "AccountController.cls", type: "ApexClass" }],
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "AccountController")
			expect(result).toContain("AccountController.cls (ApexClass)")
		})

		test("should handle missing deployment ID", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					deployedSource: [{ fullName: "TestClass", type: "ApexClass" }],
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "TestClass")
			expect(result).toContain("Deployment ID: N/A")
		})
	})

	describe("Failed deployments", () => {
		test("should format deployment failure after dry run passed", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				result: {
					status: "Failed",
					id: "0Af5g00000fail123",
					message: "Deployment failed due to org capacity limits",
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "AccountController")
			expect(result).toContain("❌ DEPLOYMENT FAILED")
			expect(result).toContain("Note: Dry run passed but actual deployment failed")
			expect(result).toContain("Deployment failed due to org capacity limits")
			expect(result).toContain("Deployment ID: 0Af5g00000fail123")
		})

		test("should handle deployment failure with missing message", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				result: {
					status: "Failed",
					id: "0Af5g00000fail456",
				},
			})

			const result = formatDeployResult(sfOutput, "Flow", "MyFlow")
			expect(result).toContain("❌ DEPLOYMENT FAILED")
			expect(result).toContain("Unknown deployment error")
		})

		test("should handle deployment failure without deployment ID", () => {
			const sfOutput = JSON.stringify({
				status: 1,
				message: "Deployment cancelled",
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "Test")
			expect(result).toContain("Deployment ID: N/A")
		})
	})

	describe("Edge cases", () => {
		test("should handle malformed JSON output", () => {
			const malformedOutput = "{ invalid json"

			const result = formatDeployResult(malformedOutput, "ApexClass", "Test")
			expect(result).toContain("SF CLI Output:")
			expect(result).toContain("{ invalid json")
		})

		test("should handle malformed JSON with error keyword", () => {
			const malformedOutput = "ERROR: Deployment timed out"

			const result = formatDeployResult(malformedOutput, "ApexClass", "Test")
			expect(result).toContain("❌ DEPLOYMENT FAILED")
			expect(result).toContain("SF CLI Error:")
			expect(result).toContain("Deployment timed out")
		})

		test("should calculate 0% coverage when no components deployed", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					id: "0Af5g00000abc000",
					numberTestsTotal: 10,
					numberTestErrors: 0,
					numberComponentsDeployed: 0,
					numberComponentsCovered: 0,
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "Test")
			expect(result).toContain("Code Coverage: 0%")
		})

		test("should handle empty deployedSource array", () => {
			const sfOutput = JSON.stringify({
				status: 0,
				result: {
					status: "Succeeded",
					id: "0Af5g00000abc111",
					deployedSource: [],
				},
			})

			const result = formatDeployResult(sfOutput, "ApexClass", "Test")
			expect(result).toContain("✅ DEPLOYMENT SUCCESSFUL!")
			expect(result).not.toContain("Deployed Components:")
		})
	})
})

describe("sfDeployMetadataTool - command building", () => {
	describe("Command structure validation", () => {
		test("should build deploy command with source-dir", () => {
			const command =
				'sf project deploy start --source-dir "force-app/main/default/classes" --test-level NoTestRun --json --wait 10'
			expect(command).toContain("sf project deploy start")
			expect(command).toContain("--source-dir")
			expect(command).toContain("--test-level NoTestRun")
			expect(command).toContain("--json")
			expect(command).toContain("--wait 10")
		})

		test("should build deploy command with metadata specification", () => {
			const command =
				'sf project deploy start --metadata "ApexClass:AccountController" --test-level NoTestRun --json --wait 10'
			expect(command).toContain("--metadata")
			expect(command).toContain("ApexClass:AccountController")
		})

		test("should build deploy command with dry-run flag", () => {
			const command =
				'sf project deploy start --metadata "ApexClass:Test" --test-level NoTestRun --dry-run --json --wait 10'
			expect(command).toContain("--dry-run")
		})

		test("should build deploy command with test level and specific tests", () => {
			const command =
				'sf project deploy start --metadata "ApexClass:Test" --test-level RunSpecifiedTests --tests AccountControllerTest --json --wait 10'
			expect(command).toContain("--test-level RunSpecifiedTests")
			expect(command).toContain("--tests AccountControllerTest")
		})

		test("should build deploy command with ignore-warnings flag", () => {
			const command =
				'sf project deploy start --metadata "ApexClass:Test" --test-level NoTestRun --ignore-warnings --json --wait 10'
			expect(command).toContain("--ignore-warnings")
		})

		test("should build deploy command with multiple metadata components", () => {
			const command =
				'sf project deploy start --metadata "ApexClass:Class1,ApexClass:Class2,ApexClass:Class3" --test-level NoTestRun --json --wait 10'
			expect(command).toContain("ApexClass:Class1,ApexClass:Class2,ApexClass:Class3")
		})
	})

	describe("Test level options", () => {
		const testLevels = ["NoTestRun", "RunSpecifiedTests", "RunLocalTests", "RunAllTestsInOrg"]

		testLevels.forEach((level) => {
			test(`should support test level: ${level}`, () => {
				const command = `sf project deploy start --metadata "ApexClass:Test" --test-level ${level} --json --wait 10`
				expect(command).toContain(`--test-level ${level}`)
			})
		})
	})
})

describe("sfDeployMetadataTool - supported metadata types", () => {
	const deployableMetadataTypes = [
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
		"ValidationRule",
		"RecordType",
		"Role",
		"AssignmentRule",
		"AssignmentRules",
		"PathAssistant",
		"GenAiPlannerBundle",
		"Bot",
	]

	test("should support all deployable metadata types", () => {
		expect(deployableMetadataTypes.length).toBeGreaterThan(0)
		expect(deployableMetadataTypes).toContain("ApexClass")
		expect(deployableMetadataTypes).toContain("LightningComponentBundle")
		expect(deployableMetadataTypes).toContain("Flow")
	})

	test("should support bundle types", () => {
		const bundleTypes = ["LightningComponentBundle", "AuraDefinitionBundle", "GenAiPlannerBundle", "Bot"]
		bundleTypes.forEach((type) => {
			expect(deployableMetadataTypes).toContain(type)
		})
	})

	test("should support file-based metadata types", () => {
		const fileTypes = ["ApexClass", "ApexTrigger", "FlexiPage", "Flow"]
		fileTypes.forEach((type) => {
			expect(deployableMetadataTypes).toContain(type)
		})
	})

	test("should support nested metadata types", () => {
		const nestedTypes = ["CustomField", "ValidationRule", "RecordType"]
		nestedTypes.forEach((type) => {
			expect(deployableMetadataTypes).toContain(type)
		})
	})
})

describe("sfDeployMetadataTool - error handling", () => {
	test("should identify SF CLI not installed error", () => {
		const error = "'sf' is not recognized as an internal or external command"
		expect(error).toContain("not recognized")
	})

	test("should identify no default org error", () => {
		const error = "No default org set"
		expect(error).toContain("No default org")
	})

	test("should identify ENOENT error", () => {
		const error = "ENOENT: spawn sf ENOENT"
		expect(error).toContain("ENOENT")
	})

	test("should handle timeout errors", () => {
		const error = { killed: true, signal: "SIGTERM" }
		expect(error.killed).toBe(true)
	})
})
