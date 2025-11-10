import { z } from "zod"
import { toolGroupsSchema } from "./tool.js"
import { getInstructionsBySlug } from "./instructions.js"

/**
 * GroupOptions
 */

export const groupOptionsSchema = z.object({
	fileRegex: z
		.string()
		.optional()
		.refine(
			(pattern) => {
				if (!pattern) {
					return true // Optional, so empty is valid.
				}

				try {
					new RegExp(pattern)
					return true
				} catch {
					return false
				}
			},
			{ message: "Invalid regular expression pattern" },
		),
	description: z.string().optional(),
})

export type GroupOptions = z.infer<typeof groupOptionsSchema>

/**
 * GroupEntry
 */

export const groupEntrySchema = z.union([toolGroupsSchema, z.tuple([toolGroupsSchema, groupOptionsSchema])])

export type GroupEntry = z.infer<typeof groupEntrySchema>

/**
 * ModeConfig
 */

const groupEntryArraySchema = z.array(groupEntrySchema).refine(
	(groups) => {
		const seen = new Set()

		return groups.every((group) => {
			// For tuples, check the group name (first element).
			const groupName = Array.isArray(group) ? group[0] : group

			if (seen.has(groupName)) {
				return false
			}

			seen.add(groupName)
			return true
		})
	},
	{ message: "Duplicate groups are not allowed" },
)

export const modeConfigSchema = z.object({
	slug: z.string().regex(/^[a-zA-Z0-9-]+$/, "Slug must contain only letters numbers and dashes"),
	name: z.string().min(1, "Name is required"),
	roleDefinition: z.string().min(1, "Role definition is required"),
	whenToUse: z.string().optional(),
	description: z.string().optional(),
	customInstructions: z.string().optional(),
	groups: groupEntryArraySchema,
	source: z.enum(["global", "project"]).optional(),
})

export type ModeConfig = z.infer<typeof modeConfigSchema>

/**
 * CustomModesSettings
 */

export const customModesSettingsSchema = z.object({
	customModes: z.array(modeConfigSchema).refine(
		(modes) => {
			const slugs = new Set()

			return modes.every((mode) => {
				if (slugs.has(mode.slug)) {
					return false
				}

				slugs.add(mode.slug)
				return true
			})
		},
		{
			message: "Duplicate mode slugs are not allowed",
		},
	),
})

export type CustomModesSettings = z.infer<typeof customModesSettingsSchema>

/**
 * PromptComponent
 */

export const promptComponentSchema = z.object({
	roleDefinition: z.string().optional(),
	whenToUse: z.string().optional(),
	description: z.string().optional(),
	customInstructions: z.string().optional(),
})

export type PromptComponent = z.infer<typeof promptComponentSchema>

/**
 * CustomModePrompts
 */

export const customModePromptsSchema = z.record(z.string(), promptComponentSchema.optional())

export type CustomModePrompts = z.infer<typeof customModePromptsSchema>

/**
 * CustomSupportPrompts
 */

export const customSupportPromptsSchema = z.record(z.string(), z.string().optional())

export type CustomSupportPrompts = z.infer<typeof customSupportPromptsSchema>

/**
 * DEFAULT_MODES
 */

/**
 * Helper function to get instructions for a mode based on its slug
 */
function getCustomInstructionsForMode(slug: string): string {
	return getInstructionsBySlug(slug)
}

export const DEFAULT_MODES: readonly ModeConfig[] = [
	{
		slug: "Salesforce_Agent",
		name: "💻 Salesforce Agent",
		roleDefinition:
			"You are a SIID-Code, a comprehensive Salesforce Agent with expert knowledge across all Salesforce domains including Administration, Development, Declarative Tools, Data Management, Integrations, Reports & Dashboards, Platform Features, and Deployment.",
		whenToUse:
			"Use this mode exclusively for Salesforce-related tasks such as Apex code, LWC, Aura, SOQL/SOSL, Flows, Reports, Integrations, Metadata API, Packaging, Deployment, and Salesforce Admin/Architect solutions.",
		description:
			"Answer and generate solutions strictly related to Salesforce. Politely refuse anything outside Salesforce scope.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions: getCustomInstructionsForMode("salesforce_agent"),
	},
	{
		slug: "Code",
		name: "Code",
		roleDefinition:
			"You are a SIID-Code, a highly skilled software engineer with extensive knowledge in many programming languages, frameworks, design patterns, and best practices.",
		whenToUse:
			"Use this mode when you need to write, modify, refactor, or deploy code. Ideal for implementing features, fixing bugs, creating new files, making code improvements, and handling deployment across any programming language or framework.",
		description: "Write, modify, refactor, and deploy code. Always create an XML file when creating an Apex class.",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions:
			"\n\nFor Salesforce projects, use the following deployment commands:\n\n" +
			"• Deploy Apex Class:\n" +
			"  sf project deploy start --source-dir force-app/main/default/classes/MyApexClass.cls --wait 10\n\n" +
			"• Deploy Lightning Web Component (LWC):\n" +
			"  sf project deploy start --source-dir force-app/main/default/lwc/myLwcComponent --wait 10\n\n" +
			"• Deploy Apex Trigger:\n" +
			"  sf project deploy start --source-dir force-app/main/default/triggers/MyTrigger.trigger --wait 10\n\n" +
			"You can also deploy multiple components together:\n" +
			"  sf project deploy start --source-dir force-app/main/default/classes --source-dir force-app/main/default/lwc --source-dir force-app/main/default/triggers --wait 10\n\n" +
			"This ensures all Apex classes, LWC components, and triggers are deployed to your Salesforce org efficiently.",
	},
	{
		slug: "orchestrator",
		name: "🪃 Orchestrator",
		roleDefinition:
			"You are a SIID-Code strategic workflow orchestrator who coordinates complex Salesforce tasks by analyzing requests and delegating them to appropriate specialized modes. You have a comprehensive understanding of each mode's capabilities (Salesforce_Agent for admin/config, Code for development) and excel at breaking down complex problems into discrete, well-scoped subtasks.",
		whenToUse:
			"Use this mode for ANY task that needs coordination, whether simple or complex. The orchestrator will analyze the request and delegate to Salesforce_Agent mode for admin/config work, Code mode for development work, or both for hybrid tasks. Perfect for multi-step projects, complex workflows, or when you want intelligent task routing.",
		description: "Analyze requests and coordinate work across Salesforce_Agent and Code modes",
		groups: ["read", "edit", "browser", "command", "mcp"],
		customInstructions: `
            ${getCustomInstructionsForMode("orchestrator")}
        `,
	},
] as const
