import * as vscode from "vscode"
import { logger } from "./logging"

/**
 * HackDate Storage - Extension Side (VS Code globalState)
 *
 * Manages hackDate storage using VS Code's built-in extension globalState
 * This is persistent across VS Code sessions
 */

const HACK_DATE_STORAGE_KEY = "siid-code:hackDate"

export type HackDateInput = string | Date | { seconds: number; nanoseconds?: number } | number | undefined | null

/**
 * Normalize supported hackDate inputs into an ISO string
 */
export function normalizeHackDate(hackDate: HackDateInput): string | undefined {
	const date = toDate(hackDate)
	return date ? date.toISOString() : undefined
}

function toDate(hackDate: HackDateInput): Date | undefined {
	if (hackDate === undefined || hackDate === null) return undefined

	if (hackDate instanceof Date) {
		return isNaN(hackDate.getTime()) ? undefined : hackDate
	}

	if (typeof hackDate === "string") {
		const parsed = new Date(hackDate)
		return isNaN(parsed.getTime()) ? undefined : parsed
	}

	if (typeof hackDate === "number") {
		// Treat values < 1e12 as seconds, otherwise milliseconds
		const millis = hackDate > 1e12 ? hackDate : hackDate * 1000
		const parsed = new Date(millis)
		return isNaN(parsed.getTime()) ? undefined : parsed
	}

	if (typeof hackDate === "object") {
		const seconds = (hackDate as any).seconds
		const nanoseconds = (hackDate as any).nanoseconds ?? 0
		if (typeof seconds === "number") {
			const millis = seconds * 1000 + Math.floor(nanoseconds / 1_000_000)
			const parsed = new Date(millis)
			return isNaN(parsed.getTime()) ? undefined : parsed
		}
	}

	return undefined
}

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
 * @param hackDate - various supported hackDate representations or undefined to clear
 */
export async function setHackDate(globalState: vscode.Memento, hackDate: HackDateInput): Promise<void> {
	try {
		const normalized = normalizeHackDate(hackDate)
		await globalState.update(HACK_DATE_STORAGE_KEY, normalized)
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
 * @param hackDate - ISO date string or supported timestamp representations
 * @returns { allowed: boolean, daysRemaining?: number }
 */
export function isLoginAllowed(hackDate: HackDateInput): { allowed: boolean; daysRemaining?: number } {
	if (hackDate === undefined || hackDate === null) {
		// If no hackDate, allow login (first time)
		return { allowed: true }
	}

	try {
		const hackDateObj = toDate(hackDate)
		if (!hackDateObj) {
			return { allowed: false }
		}

		const currentDate = new Date()

		// Calculate days difference
		const timeDiff = currentDate.getTime() - hackDateObj.getTime()
		const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24))
		const hackDateLog = `HackDate: ${hackDateObj.toISOString()}, CurrentDate: ${currentDate.toISOString()}, DaysDiff: ${daysDiff}, TimeDiff: ${timeDiff}ms`
		logger.info(hackDateLog)

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
