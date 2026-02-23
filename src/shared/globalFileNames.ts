export const GlobalFileNames = {
	apiConversationHistory: "api_conversation_history.json",
	uiMessages: "ui_messages.json",
	mcpSettings: "mcp_settings.json",
	customModes: "custom_modes.yaml",
	taskMetadata: "task_metadata.json",
	lwcInstructions: "salesforce-dev/lwc-guide.md",
	apexInstructions: "salesforce-dev/apex-guide.md",
	asynchronousApexInstructions: "salesforce-dev/asynchronous-apex-guide.md",
	// Salesforce Admin Instructions
	assignmentRulesInstructions: "salesforce-admin/assignment-rules.md",
	customFieldInstructions: "salesforce-admin/custom-field.md",
	customObjectInstructions: "salesforce-admin/custom-object.md",
	fieldPermissionsInstructions: "salesforce-admin/field-permissions.md",
	objectPermissionsInstructions: "salesforce-admin/object-permission.md",
	pathCreationInstructions: "salesforce-admin/path-creation.md",
	profileInstructions: "salesforce-admin/profile.md",
	recordTypesInstructions: "salesforce-admin/record-types.md",
	roleCreationInstructions: "salesforce-admin/role-creation.md",
	validationRulesInstructions: "salesforce-admin/validation-rules.md",
	// Visual Force & Aura Components
	visualForceInstructions: "salesforce-dev/visual-force.md",
	auraComponentsInstructions: "salesforce-dev/aura-components.md",
	// PMD Rules Instructions
	pmdApexInstructions: "pmd/PMD_Apex_Rules.md",
	pmdHtmlInstructions: "pmd/PMD_HTML_Rules.md",
	pmdJavaScriptInstructions: "pmd/PMD_JavaScript_Rules.md",
	pmdVisualforceInstructions: "pmd/PMD_Visualforce_Rules.md",
	pmdXmlInstructions: "pmd/PMD_XML_Rules.md",
}

/**
 * Task type configuration for get_task_guides tool
 * Maps user-friendly task types to internal instruction keys
 */
export interface TaskTypeConfig {
	instructions: string[]
	description: string
	mode: "salesforce-admin" | "salesforce-dev" | "orchestrator"
}

export const TaskTypeMapping: Record<string, TaskTypeConfig> = {
	// LWC Tasks
	"create-lwc": {
		instructions: ["create_lwc"],
		description: "Create Lightning Web Component",
		mode: "salesforce-dev",
	},
	"create-lwc-with-apex": {
		instructions: ["create_lwc", "create_apex"],
		description: "Create LWC with Apex backend",
		mode: "salesforce-dev",
	},

	// Apex Tasks
	"create-apex": {
		instructions: ["create_apex"],
		description: "Create Apex class or trigger",
		mode: "salesforce-dev",
	},
	"create-async-apex": {
		instructions: ["create_async_apex"],
		description: "Create asynchronous Apex (Future, Queueable, Batch, Scheduled)",
		mode: "salesforce-dev",
	},
	"create-invocable-apex": {
		instructions: ["invocable_apex", "create_apex"],
		description: "Create Invocable Apex for Agentforce or Flows",
		mode: "salesforce-dev",
	},

	// Admin/Metadata Tasks
	"create-custom-object": {
		instructions: ["custom_object", "custom_field", "page-layout", "field_permissions", "object_permissions"],
		description: "Create custom object with fields and validations",
		mode: "salesforce-admin",
	},
	"setup-profile-permissions": {
		instructions: ["profile", "object_permissions", "field_permissions"],
		description: "Setup profile with object and field permissions",
		mode: "salesforce-admin",
	},
	"create-assignment-rules": {
		instructions: ["assignment_rules"],
		description: "Create assignment rules",
		mode: "salesforce-admin",
	},
	"create-record-types": {
		instructions: ["record_types", "path_creation"],
		description: "Create record types with path",
		mode: "salesforce-admin",
	},
	"create-roles": {
		instructions: ["role_creation"],
		description: "Create role hierarchy",
		mode: "salesforce-admin",
	},
	"create-validation-rules": {
		instructions: ["validation_rules"],
		description: "Create validation rules",
		mode: "salesforce-admin",
	},

	// MCP/Modes
	"create-mcp-server": {
		instructions: ["create_mcp_server"],
		description: "Create MCP server",
		mode: "salesforce-dev",
	},
	"create-custom-mode": {
		instructions: ["create_mode"],
		description: "Create custom mode",
		mode: "salesforce-dev",
	},
}
