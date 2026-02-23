/**
 * Salesforce Admin instructions
 */
export const SALESFORCE_ADMIN_INSTRUCTIONS: string

/**
 * Salesforce Developer instructions
 */
export const SALESFORCE_DEV_INSTRUCTIONS: string

/**
 * Orchestrator instructions
 */
export const ORCHESTRATOR_INSTRUCTIONS: string

/**
 * Helper function to get instructions by mode slug
 * @param slug The mode slug
 * @returns The instructions for the specified mode
 */
export function getInstructionsBySlug(slug: string): string
