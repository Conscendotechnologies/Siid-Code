import { describe, it, expect } from "vitest"
import { getFetchInstructionsDescription } from "../fetch-instructions"

describe("getFetchInstructionsDescription", () => {
	it("should include create_mcp_server when enableMcpServerCreation is true", () => {
		const description = getFetchInstructionsDescription(true)

		expect(description).toContain("create_mcp_server")
		expect(description).toContain("create_mode")
		expect(description).toContain("Example: Requesting instructions to create an MCP Server")
		expect(description).toContain("<task>create_mcp_server</task>")
	})

	it("should include create_mcp_server when enableMcpServerCreation is undefined (default behavior)", () => {
		const description = getFetchInstructionsDescription()

		expect(description).toContain("create_mcp_server")
		expect(description).toContain("create_mode")
		expect(description).toContain("Example: Requesting instructions to create an MCP Server")
		expect(description).toContain("<task>create_mcp_server</task>")
	})

	it("should exclude create_mcp_server when enableMcpServerCreation is false", () => {
		const description = getFetchInstructionsDescription(false)

		expect(description).not.toContain("create_mcp_server")
		expect(description).toContain("create_mode")
		expect(description).toContain("Example: Requesting instructions to create a Mode")
		expect(description).toContain("<task>create_mode</task>")
		expect(description).not.toContain("Example: Requesting instructions to create an MCP Server")
	})

	it("should have the correct structure", () => {
		const description = getFetchInstructionsDescription(true)

		expect(description).toContain("## fetch_instructions")
		expect(description).toContain("Description: Request to fetch instructions to perform a task")
		expect(description).toContain("Parameters:")
		expect(description).toContain("- task: (required) The task to get instructions for.")
		expect(description).toContain("<fetch_instructions>")
		expect(description).toContain("</fetch_instructions>")
	})

	it("should handle null value consistently (treat as default/undefined)", () => {
		const description = getFetchInstructionsDescription(null as any)

		// Should behave the same as undefined (default to true)
		expect(description).toContain("create_mcp_server")
		expect(description).toContain("create_mode")
		expect(description).toContain("Example: Requesting instructions to create an MCP Server")
		expect(description).toContain("<task>create_mcp_server</task>")
	})

	it("should include all Salesforce Agent instruction tasks", () => {
		const description = getFetchInstructionsDescription(true)

		// Check for all Salesforce Agent tasks
		expect(description).toContain("approval_process")
		expect(description).toContain("assignment_rules")
		expect(description).toContain("custom_field")
		expect(description).toContain("custom_object")
		expect(description).toContain("field_permissions")
		expect(description).toContain("object_permissions")
		expect(description).toContain("path_creation")
		expect(description).toContain("profile")
		expect(description).toContain("record_types")
		expect(description).toContain("role_creation")
		expect(description).toContain("validation_rules")
	})

	it("should include Salesforce Agent examples", () => {
		const description = getFetchInstructionsDescription(true)

		// Check for Salesforce Agent examples
		expect(description).toContain("Example: Requesting instructions for Salesforce Assignment Rules")
		expect(description).toContain("<task>assignment_rules</task>")
		expect(description).toContain("Example: Requesting instructions for Salesforce Custom Field")
		expect(description).toContain("<task>custom_field</task>")
	})

	it("should include Salesforce Agent tasks even when MCP server creation is disabled", () => {
		const description = getFetchInstructionsDescription(false)

		// Salesforce Agent tasks should still be present
		expect(description).toContain("approval_process")
		expect(description).toContain("assignment_rules")
		expect(description).toContain("custom_field")
		expect(description).toContain("custom_object")
		expect(description).toContain("validation_rules")
		expect(description).toContain("<task>custom_object</task>")
	})
})
