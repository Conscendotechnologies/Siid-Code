import { createMCPServerInstructions } from "./create-mcp-server"
import { createModeInstructions } from "./create-mode"
import { createLWCInstructions } from "./create-lwc"
import { createApexInstructions } from "./create-apex"
import {
	assignmentRulesInstructions,
	customFieldInstructions,
	customObjectInstructions,
	fieldPermissionsInstructions,
	objectPermissionsInstructions,
	pathCreationInstructions,
	profileInstructions,
	recordTypesInstructions,
	roleCreationInstructions,
	validationRulesInstructions,
} from "./salesforce-instructions"
import { invocableApexInstructions } from "./code-instructions"
import { McpHub } from "../../../services/mcp/McpHub"
import { DiffStrategy } from "../../../shared/tools"
import * as vscode from "vscode"

interface InstructionsDetail {
	mcpHub?: McpHub
	diffStrategy?: DiffStrategy
	context?: vscode.ExtensionContext
	section?: string
}

export async function fetchInstructions(text: string, detail: InstructionsDetail): Promise<string> {
	switch (text) {
		case "create_mcp_server": {
			return await createMCPServerInstructions(detail.mcpHub, detail.diffStrategy)
		}
		case "create_mode": {
			return await createModeInstructions(detail.context)
		}
		case "create_lwc": {
			return await createLWCInstructions(detail.context, detail.section)
		}
		case "create_apex": {
			return await createApexInstructions(detail.context, detail.section)
		}
		// Salesforce Agent Instructions
		case "assignment_rules": {
			return await assignmentRulesInstructions(detail.context)
		}
		case "custom_field": {
			return await customFieldInstructions(detail.context)
		}
		case "custom_object": {
			return await customObjectInstructions(detail.context)
		}
		case "field_permissions": {
			return await fieldPermissionsInstructions(detail.context)
		}
		case "object_permissions": {
			return await objectPermissionsInstructions(detail.context)
		}
		case "path_creation": {
			return await pathCreationInstructions(detail.context)
		}
		case "profile": {
			return await profileInstructions(detail.context)
		}
		case "record_types": {
			return await recordTypesInstructions(detail.context)
		}
		case "role_creation": {
			return await roleCreationInstructions(detail.context)
		}
		case "validation_rules": {
			return await validationRulesInstructions(detail.context)
		}
		// Code Instructions
		case "invocable_apex": {
			return await invocableApexInstructions(detail.context)
		}
		default: {
			return ""
		}
	}
}
