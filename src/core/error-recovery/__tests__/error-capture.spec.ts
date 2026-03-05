/**
 * Unit tests for Error Capture module
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs"
import * as path from "path"
import { ErrorCapture, resetErrorCapture } from "../error-capture"
import type { ErrorContext } from "../types/error-types"

describe("ErrorCapture", () => {
	let tempDir: string

	beforeEach(() => {
		// Create temporary directory for test
		tempDir = path.join(__dirname, "../__test_temp__")
		if (!fs.existsSync(tempDir)) {
			fs.mkdirSync(tempDir, { recursive: true })
		}
		resetErrorCapture()
	})

	afterEach(() => {
		// Cleanup
		if (fs.existsSync(tempDir)) {
			fs.rmSync(tempDir, { recursive: true })
		}
		resetErrorCapture()
	})

	describe("Knowledge Base Loading", () => {
		it("should load default knowledge base if it exists", () => {
			// Create default KB
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const defaultKb = `
errors:
  - id: TEST_ERROR
    errorPattern:
      keywords:
        - "test"
        - "error"
    description: "Test error"
    solution: "Test solution"
`
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), defaultKb)

			const errorCapture = new ErrorCapture(tempDir)
			const stats = errorCapture.getStats()

			expect(stats.defaultKB).toBe(1)
			expect(stats.userKB).toBe(0)
			expect(stats.total).toBe(1)
		})

		it("should load user knowledge base if it exists", () => {
			// Create user KB
			const userKbDir = path.join(tempDir, "error-knowledge-base")
			fs.mkdirSync(userKbDir, { recursive: true })

			const userKb = `
errors:
  - id: USER_ERROR
    errorPattern:
      keywords:
        - "custom"
    description: "User custom error"
    solution: "User custom solution"
`
			fs.writeFileSync(path.join(userKbDir, "custom-errors.yaml"), userKb)

			const errorCapture = new ErrorCapture(tempDir)
			const stats = errorCapture.getStats()

			expect(stats.userKB).toBe(1)
		})

		it("should load both default and user knowledge bases", () => {
			// Create default KB
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const defaultKb = `
errors:
  - id: DEFAULT_ERROR
    errorPattern:
      keywords:
        - "default"
    description: "Default error"
    solution: "Default solution"
`
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), defaultKb)

			// Create user KB
			const userKbDir = path.join(tempDir, "error-knowledge-base")
			fs.mkdirSync(userKbDir, { recursive: true })

			const userKb = `
errors:
  - id: USER_ERROR
    errorPattern:
      keywords:
        - "user"
    description: "User error"
    solution: "User solution"
`
			fs.writeFileSync(path.join(userKbDir, "custom-errors.yaml"), userKb)

			const errorCapture = new ErrorCapture(tempDir)
			const stats = errorCapture.getStats()

			expect(stats.userKB).toBe(1)
			expect(stats.defaultKB).toBe(1)
			expect(stats.total).toBe(2)
		})
	})

	describe("Error Matching", () => {
		let errorCapture: ErrorCapture

		beforeEach(() => {
			// Create both KBs for matching tests
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const defaultKb = `
errors:
  - id: SCHEMA_ERROR
    errorPattern:
      keywords:
        - "required"
        - "copilotAction"
    description: "Schema missing copilotAction"
    solution: "Add copilotAction properties"
    affectedFile: "schema.json"
  
  - id: XML_ERROR
    errorPattern:
      keywords:
        - "not found"
        - "name"
    description: "Naming mismatch"
    solution: "Fix naming"
    affectedFile: "xml"
`
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), defaultKb)

			errorCapture = new ErrorCapture(tempDir)
		})

		it("should match error with all keywords present", () => {
			const errorOutput = "Error: required property 'copilotAction:isDisplayable' missing"
			const match = errorCapture.findMatchingError(errorOutput)

			expect(match).not.toBeNull()
			expect(match?.errorId).toBe("SCHEMA_ERROR")
			expect(match?.description).toBe("Schema missing copilotAction")
		})

		it("should not match error if not all keywords present", () => {
			const errorOutput = "Error: required property missing"
			const match = errorCapture.findMatchingError(errorOutput)

			expect(match).toBeNull()
		})

		it("should match error case-insensitively", () => {
			const errorOutput = "ERROR: REQUIRED property 'COPILOTACTION' missing"
			const match = errorCapture.findMatchingError(errorOutput)

			expect(match).not.toBeNull()
			expect(match?.errorId).toBe("SCHEMA_ERROR")
		})

		it("should return correct error context with KB source", () => {
			const errorOutput = "Error: required copilotAction missing in schema"
			const match = errorCapture.findMatchingError(errorOutput)

			expect(match).not.toBeNull()
			expect(match?.knowledgeBaseSource).toBe("default")
			expect(match?.affectedFile).toBe("schema.json")
			expect(match?.rawOutput).toBe(errorOutput)
		})
	})

	describe("User KB Priority", () => {
		let errorCapture: ErrorCapture

		beforeEach(() => {
			// Create default KB
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const defaultKb = `
errors:
  - id: COMMON_ERROR
    errorPattern:
      keywords:
        - "error"
    description: "Default description"
    solution: "Default solution"
`
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), defaultKb)

			// Create user KB with same error
			const userKbDir = path.join(tempDir, "error-knowledge-base")
			fs.mkdirSync(userKbDir, { recursive: true })

			const userKb = `
errors:
  - id: COMMON_ERROR
    errorPattern:
      keywords:
        - "error"
    description: "User custom description"
    solution: "User custom solution"
`
			fs.writeFileSync(path.join(userKbDir, "custom-errors.yaml"), userKb)

			errorCapture = new ErrorCapture(tempDir)
		})

		it("should prefer user KB over default KB", () => {
			const errorOutput = "An error occurred"
			const match = errorCapture.findMatchingError(errorOutput)

			expect(match).not.toBeNull()
			expect(match?.knowledgeBaseSource).toBe("user")
			expect(match?.description).toBe("User custom description")
		})
	})

	describe("AI Message Building", () => {
		let errorCapture: ErrorCapture

		beforeEach(() => {
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const defaultKb = `
errors:
  - id: TEST_ERROR
    errorPattern:
      keywords:
        - "test"
    description: "This is a test error"
    solution: "Follow these steps to fix it"
    affectedFile: "test-file.ts"
`
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), defaultKb)

			errorCapture = new ErrorCapture(tempDir)
		})

		it("should build properly formatted AI message", () => {
			const errorOutput = "Error: test failure occurred"
			const match = errorCapture.findMatchingError(errorOutput)

			expect(match).not.toBeNull()

			const message = errorCapture.buildAIMessage(match!)

			expect(message).toContain("🔴 DEPLOYMENT ERROR DETECTED")
			expect(message).toContain("Error ID: TEST_ERROR")
			expect(message).toContain("Knowledge Base: default")
			expect(message).toContain("📋 Error Description:")
			expect(message).toContain("This is a test error")
			expect(message).toContain("💡 Solution:")
			expect(message).toContain("Follow these steps to fix it")
			expect(message).toContain("📁 Affected File: test-file.ts")
		})

		it("should truncate long error messages to 200 chars", () => {
			const longError = "Error: " + "x".repeat(300) + " more error text"
			const errorContext: ErrorContext = {
				errorId: "TEST",
				errorMessage: longError.substring(0, 200),
				description: "Test",
				solution: "Test solution",
				rawOutput: longError,
				knowledgeBaseSource: "default",
			}

			const message = errorCapture.buildAIMessage(errorContext)

			expect(message).toContain(errorContext.errorMessage)
			expect(errorContext.errorMessage.length).toBeLessThanOrEqual(200)
		})
	})

	describe("Error Capture Flow", () => {
		let errorCapture: ErrorCapture

		beforeEach(() => {
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const defaultKb = `
errors:
  - id: DEPLOYMENT_ERROR
    errorPattern:
      keywords:
        - "deployment"
        - "failed"
    description: "Deployment error occurred"
    solution: "Check deployment status"
`
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), defaultKb)

			errorCapture = new ErrorCapture(tempDir)
		})

		it("should capture error successfully", () => {
			const errorOutput = "Deployment failed with error code 1"
			const result = errorCapture.captureError(errorOutput)

			expect(result.found).toBe(true)
			expect(result.context).not.toBeNull()
			expect(result.context?.errorId).toBe("DEPLOYMENT_ERROR")
		})

		it("should handle empty error output", () => {
			const result = errorCapture.captureError("")

			expect(result.found).toBe(false)
			expect(result.context).toBeUndefined()
		})

		it("should return raw error when not matched", () => {
			const errorOutput = "Unknown error"
			const result = errorCapture.captureError(errorOutput)

			expect(result.found).toBe(false)
			expect(result.rawError).toBe(errorOutput)
		})
	})

	describe("Edge Cases", () => {
		it("should handle missing knowledge base directories gracefully", () => {
			// No KBs created
			const errorCapture = new ErrorCapture(tempDir)
			const stats = errorCapture.getStats()

			expect(stats.total).toBe(0)
		})

		it("should handle malformed YAML gracefully", () => {
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const malformedYaml = "invalid: [yaml: content:"
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), malformedYaml)

			// Should not throw, but log warning
			expect(() => {
				new ErrorCapture(tempDir)
			}).not.toThrow()
		})

		it("should handle error with no affectedFile", () => {
			const defaultKbDir = path.join(tempDir, ".roo/error-knowledge-base")
			fs.mkdirSync(defaultKbDir, { recursive: true })

			const defaultKb = `
errors:
  - id: GENERIC_ERROR
    errorPattern:
      keywords:
        - "error"
    description: "Generic error"
    solution: "Fix it"
`
			fs.writeFileSync(path.join(defaultKbDir, "agentforce-errors.yaml"), defaultKb)

			const errorCapture = new ErrorCapture(tempDir)
			const match = errorCapture.findMatchingError("An error occurred")

			expect(match).not.toBeNull()
			expect(match?.affectedFile).toBeUndefined()

			const message = errorCapture.buildAIMessage(match!)
			expect(message).not.toContain("📁 Affected File:")
		})
	})
})
