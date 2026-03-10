import * as vscode from "vscode"

/**
 * HackDate Storage - Extension Side (VS Code globalState)
 *
 * Manages hackDate storage using VS Code's built-in extension globalState
 * This is persistent across VS Code sessions
 */

const HACK_DATE_STORAGE_KEY = "siid-code:hackDate"

/**
 * Get hackDate from VS Code globalState
 * @param globalState - VS Code extension context globalState
 * @returns hackDate as ISO string or undefined if not set
 */
export async function getHackDate(globalState: vscode.Memento): Promise<string | undefined> {
	try {
		return globalState.get<string>(HACK_DATE_STORAGE_KEY)
	} catch (error) {
		console.error(`Failed to get hackDate: ${error instanceof Error ? error.message : String(error)}`)
		return undefined
	}
}

/**
 * Store hackDate in VS Code globalState
 * @param globalState - VS Code extension context globalState
 * @param hackDate - ISO date string or undefined to clear
 */
export async function setHackDate(globalState: vscode.Memento, hackDate: string | undefined): Promise<void> {
	try {
		await globalState.update(HACK_DATE_STORAGE_KEY, hackDate)
	} catch (error) {
		console.error(`Failed to store hackDate: ${error instanceof Error ? error.message : String(error)}`)
		throw error
	}
}

/**
 * Clear hackDate from VS Code globalState
 * @param globalState - VS Code extension context globalState
 */
export async function clearHackDate(globalState: vscode.Memento): Promise<void> {
	try {
		await globalState.update(HACK_DATE_STORAGE_KEY, undefined)
	} catch (error) {
		console.error(`Failed to clear hackDate: ${error instanceof Error ? error.message : String(error)}`)
		throw error
	}
}

/**
 * Check if login is allowed based on stored hackDate
 * Login is allowed if within 2 days from hackDate
 * @param hackDate - ISO date string
 * @returns { allowed: boolean, daysRemaining?: number }
 */
export function isLoginAllowed(hackDate: string | undefined): { allowed: boolean; daysRemaining?: number } {
	if (!hackDate) {
		// If no hackDate, allow login (first time)
		return { allowed: true }
	}

	try {
		const hackDateObj = new Date(hackDate)
		const currentDate = new Date()

		// Calculate days difference
		const timeDiff = currentDate.getTime() - hackDateObj.getTime()
		const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))

		// Allow login within 2 days from hackDate
		const DAYS_ALLOWED = 2
		const allowed = daysDiff <= DAYS_ALLOWED

		// Calculate days remaining
		const daysRemaining = DAYS_ALLOWED - daysDiff

		return {
			allowed,
			daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
		}
	} catch (error) {
		// If date parsing fails, deny login
		return { allowed: false }
	}
}
