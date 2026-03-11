/**
 * Firebase Service API Helper
 *
 * This module provides a convenient wrapper around the Firebase Service extension API.
 * It uses the exported API instead of command-based communication for better performance
 * and type safety.
 */

import * as vscode from "vscode"
import { createOutputChannelLogger } from "./outputChannelLogger"

/**
 * Sanitize data for Firebase Firestore storage
 * Removes circular references, undefined values, functions, and limits nesting depth
 * @param obj Object to sanitize
 * @param maxDepth Maximum nesting depth (default: 10)
 * @param currentDepth Current depth in recursion
 * @param seen Set to track circular references
 * @returns Sanitized object safe for Firestore
 */
function sanitizeForFirestore(
	obj: any,
	maxDepth: number = 10,
	currentDepth: number = 0,
	seen: WeakSet<object> = new WeakSet(),
): any {
	// Handle primitives
	if (obj === null || obj === undefined) {
		return null
	}

	// Handle numbers - check for NaN and Infinity
	if (typeof obj === "number") {
		if (Number.isNaN(obj)) {
			return null
		}
		if (!Number.isFinite(obj)) {
			return obj > 0 ? "Infinity" : "-Infinity"
		}
		return obj
	}

	if (typeof obj === "string" || typeof obj === "boolean") {
		return obj
	}

	// Handle BigInt (not supported by JSON/Firestore)
	if (typeof obj === "bigint") {
		return obj.toString()
	}

	// Handle symbols (not supported by JSON/Firestore)
	if (typeof obj === "symbol") {
		return obj.toString()
	}

	// Handle dates
	if (obj instanceof Date) {
		return obj.toISOString()
	}

	// Handle RegExp
	if (obj instanceof RegExp) {
		return obj.toString()
	}

	// Handle Error objects
	if (obj instanceof Error) {
		return {
			name: obj.name,
			message: obj.message,
			stack: obj.stack?.substring(0, 500), // Limit stack trace length
		}
	}

	// Handle Map objects
	if (obj instanceof Map) {
		const plainObj: Record<string, any> = {}
		obj.forEach((value, key) => {
			plainObj[String(key)] = sanitizeForFirestore(value, maxDepth, currentDepth + 1, seen)
		})
		return plainObj
	}

	// Handle Set objects
	if (obj instanceof Set) {
		return Array.from(obj).map((item) => sanitizeForFirestore(item, maxDepth, currentDepth + 1, seen))
	}

	// Check depth limit
	if (currentDepth >= maxDepth) {
		return "[Max depth reached]"
	}

	// Handle arrays
	if (Array.isArray(obj)) {
		// Limit array size to prevent huge logs
		const maxArraySize = 100
		const limitedArray = obj.slice(0, maxArraySize)
		const result = limitedArray.map((item) => sanitizeForFirestore(item, maxDepth, currentDepth + 1, seen))
		if (obj.length > maxArraySize) {
			result.push(`[... ${obj.length - maxArraySize} more items truncated]`)
		}
		return result
	}

	// Handle objects
	if (typeof obj === "object") {
		// Check for circular references
		if (seen.has(obj)) {
			return "[Circular Reference]"
		}
		seen.add(obj)

		const result: Record<string, any> = {}
		let fieldCount = 0
		const maxFields = 50 // Limit number of fields to prevent huge objects

		for (const key in obj) {
			if (Object.prototype.hasOwnProperty.call(obj, key)) {
				// Skip functions
				if (typeof obj[key] === "function") {
					continue
				}

				// Skip undefined values
				if (obj[key] === undefined) {
					continue
				}

				// Limit number of fields
				if (fieldCount >= maxFields) {
					result["[truncated]"] = `... ${Object.keys(obj).length - maxFields} more fields`
					break
				}

				try {
					result[key] = sanitizeForFirestore(obj[key], maxDepth, currentDepth + 1, seen)
					fieldCount++
				} catch (error) {
					// If accessing or sanitizing this field fails, store error message
					result[key] = `[Error accessing field: ${error instanceof Error ? error.message : String(error)}]`
					fieldCount++
				}
			}
		}

		return result
	}

	// For any other type, convert to string
	return String(obj)
}

// Firebase Service extension ID
const FIREBASE_SERVICE_EXTENSION_ID = "ConscendoTechInc.firebase-service"

// Cache for the Firebase API instance
let cachedFirebaseAPI: any = null

/**
 * Get the Firebase Service API
 * @param outputChannel Optional output channel for logging
 * @returns Firebase API object or null if extension not available
 */
export async function getFirebaseAPI(outputChannel?: vscode.OutputChannel): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	// Return cached instance if available
	if (cachedFirebaseAPI) {
		return cachedFirebaseAPI
	}

	try {
		log("Attempting to get Firebase Service extension")
		// Get the Firebase Service extension
		const firebaseExt = vscode.extensions.getExtension(FIREBASE_SERVICE_EXTENSION_ID)

		if (!firebaseExt) {
			log("Firebase Service extension not found")
			return null
		}

		log("Firebase Service extension found, checking if active")
		// Activate the extension if not already activated
		if (!firebaseExt.isActive) {
			log("Activating Firebase Service extension")
			await firebaseExt.activate()
			// Small delay to ensure exports are set
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		// Check if exports are available
		if (!firebaseExt.exports) {
			log("Firebase Service extension exports not available")
			return null
		}

		// The extension now exports the API object directly
		const firebaseAPI = firebaseExt.exports

		// Verify it has the expected methods
		if (!firebaseAPI.signIn || !firebaseAPI.signOut || !firebaseAPI.getCurrentUser) {
			log("Firebase API missing expected methods")
			return null
		}

		log("Firebase API successfully loaded and cached")
		// Cache the API instance
		cachedFirebaseAPI = firebaseAPI

		return firebaseAPI
	} catch (error) {
		log("Error getting Firebase API:", error)
		return null
	}
}

/**
 * Check if user is authenticated
 * @param outputChannel Optional output channel for logging
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(outputChannel?: vscode.OutputChannel): Promise<boolean> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		// Check for dev bypass mode first
		const context = (global as any).__rooCodeExtensionContext as vscode.ExtensionContext | undefined
		if (context) {
			const devBypassActive = context.globalState.get<boolean>("devBypassActive")
			if (devBypassActive) {
				return true
			}
		}

		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for authentication check")
			return false
		}

		// Check if the API has isAuthenticated method
		if (typeof api.isAuthenticated !== "function") {
			log("isAuthenticated method not available, trying getCurrentSession")
			// Try getCurrentSession as an alternative
			if (typeof api.getCurrentSession === "function") {
				const session = await api.getCurrentSession()
				const isAuth = !!session
				log("Authentication status via getCurrentSession:", isAuth)
				return isAuth
			}
			log("No authentication method available")
			return false
		}

		const isAuth = await api.isAuthenticated()
		return !!isAuth
	} catch (error) {
		log("Error checking authentication:", error)
		return false
	}
}

/**
 * Get current user details
 * @param outputChannel Optional output channel for logging
 * @returns User object or null
 */
export async function getCurrentUser(outputChannel?: vscode.OutputChannel): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Getting current user")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting current user")
			return null
		}

		const user = await api.getCurrentUser()
		log("Current user retrieved:", user ? "User found" : "No user")
		return user
	} catch (error) {
		log("Error getting current user:", error)
		return null
	}
}

/**
 * Store data in Firestore
 * @param collection Collection name
 * @param documentId Document ID
 * @param data Data to store
 * @param outputChannel Optional output channel for logging
 * @throws Error if storing fails
 */
export async function storeData(
	collection: string,
	documentId: string,
	data: Record<string, any>,
	outputChannel?: vscode.OutputChannel,
): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(`Storing data in collection '${collection}', document '${documentId}'`)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for storing data")
			throw new Error("Firebase API not available")
		}
		await api.storeData(collection, documentId, data)
		log("Data stored successfully")
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		log("Error storing data:", error)
		throw error
	}
}

/**
 * Get data from Firestore
 * @param collection Collection name
 * @param documentId Document ID
 * @param outputChannel Optional output channel for logging
 * @returns Document data or error object
 */
export async function getData(
	collection: string,
	documentId: string,
	outputChannel?: vscode.OutputChannel,
): Promise<any> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(`Getting data from collection '${collection}', document '${documentId}'`)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting data")
			return { error: "Firebase API not available" }
		}

		const result = await api.getData(collection, documentId)
		log("Data retrieved successfully")
		return result
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		log("Error getting data:", error)
		return {
			error: errorMessage,
		}
	}
}

/**
 * Get admin API key from Firebase
 * @param outputChannel Optional output channel for logging
 * @returns Admin API key or null if not found
 */
export async function getAdminApiKey(outputChannel?: vscode.OutputChannel): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting admin API key")
			return null
		}

		const adminConfig = await api.getAdminApiKey()

		return adminConfig || null
	} catch (error) {
		log("Error getting admin API key:", error)
		return null
	}
} /**
 * Get user properties from Firestore (users/{uid})
 * @param propertyNames Optional array of property names to retrieve. If not provided, returns all data.
 * @param outputChannel Optional output channel for logging
 * @returns User data object with requested properties or null if not found
 */
export async function getUserProperties(
	propertyNames?: string[],
	outputChannel?: vscode.OutputChannel,
): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(
			"Getting user properties",
			propertyNames ? `for properties: ${propertyNames.join(", ")}` : "(all properties)",
		)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting user properties")
			return null
		}

		const userData = await api.getUserProperties(propertyNames)
		log(userData ? "User properties retrieved" : "No user properties found")
		return userData || null
	} catch (error) {
		log("Error getting user properties:", error)
		return null
	}
}

/**
 * Update user properties in Firestore (users/{uid})
 * Can update one or multiple key-value pairs
 * @param updates Object containing field names and values to update
 * @param outputChannel Optional output channel for logging
 * @throws Error if update fails
 */
export async function updateUserProperties(
	updates: Record<string, any>,
	outputChannel?: vscode.OutputChannel,
): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Updating user properties:", Object.keys(updates))
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for updating user properties")
			throw new Error("Firebase API not available")
		}

		await api.updateUserProperties(updates)
		log("User properties updated successfully")
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		log("Error updating user properties:", error)
		throw error
	}
}

/**
 * Sign out the current user
 * @param outputChannel Optional output channel for logging
 */
export async function logout(outputChannel?: vscode.OutputChannel): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Logging out user")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for logout")
			return
		}

		await api.signOut()
		log("User logged out successfully")
	} catch (error) {
		log("Error during logout:", error)
		throw error
	}
}

/**
 * Listen to authentication state changes
 * @param callback Function to call when auth state changes
 * @param outputChannel Optional output channel for logging
 * @returns Disposable to unsubscribe
 */
export async function onAuthStateChanged(
	callback: (isAuthenticated: boolean) => void,
	outputChannel?: vscode.OutputChannel,
): Promise<vscode.Disposable | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Setting up auth state change listener")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for auth state listener")
			return null
		}

		// Firebase API's onAuthStateChanged should return a disposable
		const disposable = api.onAuthStateChanged(callback)
		log("Auth state change listener set up successfully")
		return disposable
	} catch (error) {
		log("Error setting up auth state listener:", error)
		return null
	}
}

/**
 * Clear the cached Firebase API instance
 * Useful when the Firebase Service extension is updated or reloaded
 */
export function clearFirebaseAPICache(): void {
	cachedFirebaseAPI = null
}

/**
 * Login to Firebase
 * @param outputChannel Optional output channel for logging
 */
export async function onFirebaseLogin(outputChannel?: vscode.OutputChannel): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Initiating Firebase login")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for login")
			throw new Error("Firebase API not available")
		}

		// Assuming the API has a login method, but since login is via command, perhaps call the command
		// But since this is a helper, perhaps just call the command
		log("Executing Firebase sign-in command")
		await vscode.commands.executeCommand("firebase-service.signIn")
		log("Firebase login command executed")
	} catch (error) {
		log("Error during Firebase login:", error)
		throw error
	}
}

/**
 * Logout from Firebase
 * @param outputChannel Optional output channel for logging
 */
export async function onFirebaseLogout(outputChannel?: vscode.OutputChannel): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	log("Initiating Firebase logout")
	await logout(outputChannel)
}

/**
 * Add a log entry to siid-code-logs collection
 * Logs are stored at: siid-code-logs/{userId_logId}
 * @param eventType Type/category of the event
 * @param data Event-specific data (flexible JSON)
 * @param outputChannel Optional output channel for logging
 */
export async function addLog(
	eventType: string,
	data: Record<string, any>,
	outputChannel?: vscode.OutputChannel,
): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(`Adding log entry: eventType='${eventType}'`)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for adding log")
			return // Fail silently - don't block user actions
		}

		// Get current user to retrieve UID
		const user = await api.getCurrentUser()
		if (!user || !user.uid) {
			log("No authenticated user found for adding log")
			return // Fail silently
		}

		// Get current tier from global state if available
		const context = (global as any).__rooCodeExtensionContext as vscode.ExtensionContext | undefined
		let tier: "Free" | "Pro" | "Max" | undefined
		if (context) {
			tier = context.globalState.get<"Free" | "Pro" | "Max">("tier")
		}

		// Get extension version
		const version = context?.extension?.packageJSON?.version

		// Create log entry with timestamp
		const logEntry = {
			timestamp: new Date().toISOString(),
			eventType,
			data,
			...(tier && { tier }),
			...(version && { version }),
		}

		// Sanitize the ENTIRE log entry to prevent Firestore errors
		// This removes circular references, undefined values, NaN, Infinity, and limits nesting depth
		const sanitizedLogEntry = sanitizeForFirestore(logEntry)

		// Additional defensive measure: convert to JSON and back to ensure no hidden objects
		// This catches any remaining Map, Set, WeakMap, WeakSet, or other non-serializable types
		const finalData = JSON.parse(JSON.stringify(sanitizedLogEntry))

		// Flatten the structure completely to avoid nested entity errors
		// Firebase Service wraps our data in a 'data' field, so we must ensure
		// EVERYTHING we pass is a primitive value (string, number, boolean, null)
		const flattenedData: Record<string, string | number | boolean | null> = {
			userId: user.uid, // Add userId as queryable field
			timestamp: String(finalData.timestamp),
			eventType: String(finalData.eventType),
		}

		// Add optional fields if present - ensure they're primitives
		if (finalData.tier) flattenedData.tier = String(finalData.tier)
		if (finalData.version) flattenedData.version = String(finalData.version)

		// Stringify the entire data object as a single JSON field
		// This is the safest approach to avoid any nested entity issues
		if (finalData.data && typeof finalData.data === "object") {
			flattenedData.payload = JSON.stringify(finalData.data)
		}

		// Store log in flat structure: siid-code-logs/{userId_logId}
		// Generate unique document ID with user ID prefix
		const documentId = `${user.uid}_log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
		const collectionName = `siid-code-logs`

		// Use storeData helper function for consistent error handling and logging
		await storeData(collectionName, documentId, flattenedData, outputChannel)
		log(`Log entry added successfully: ${collectionName}/${documentId}`)
	} catch (error) {
		// Fail silently - logging should never block user actions
		log("Error adding log entry (non-critical):", error)
	}
}

/**
 * Get log entries for current user
 * @param limit Maximum number of logs to retrieve (default: 50)
 * @param startAfter Optional cursor for pagination (ISO timestamp)
 * @param outputChannel Optional output channel for logging
 * @returns Array of log entries, sorted by timestamp descending (newest first)
 */
export async function getLogs(
	limit: number = 50,
	startAfter?: string,
	outputChannel?: vscode.OutputChannel,
): Promise<any[]> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(`Getting logs: limit=${limit}, startAfter=${startAfter || "none"}`)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting logs")
			return []
		}

		// Get current user to retrieve UID
		const user = await api.getCurrentUser()
		if (!user || !user.uid) {
			log("No authenticated user found for getting logs")
			return []
		}

		const collectionName = `siid-code-logs`

		// Check if Firebase API has a method to query collection
		if (typeof api.queryCollection === "function") {
			// Query the collection - Firebase Service automatically filters by user
			// The storeData method adds userId field at top level, so it should auto-filter
			const logs = await api.queryCollection(collectionName, {
				orderBy: "timestamp",
				orderDirection: "desc",
				limit,
				...(startAfter && { startAfter }),
			})

			// Filter by userId in case Firebase Service doesn't auto-filter
			// Document IDs are prefixed with userId: {userId}_log_{timestamp}_{random}
			const userLogs = (logs || []).filter((logDoc: any) => {
				// Check if document ID starts with user's UID
				const docId = logDoc.id || logDoc._id || ""
				return docId.startsWith(`${user.uid}_`)
			})

			log(`Retrieved ${userLogs.length} log entries for user ${user.uid}`)
			return userLogs
		} else if (typeof api.getData === "function") {
			// Fallback: Try to get documents by ID pattern
			log("Using getData fallback to retrieve logs")

			// Try to get recent logs by constructing IDs based on recent timestamps
			const now = Date.now()
			const oneDayAgo = now - 24 * 60 * 60 * 1000
			const logs: any[] = []

			// Try to fetch a few recent log documents
			for (let i = 0; i < 10; i++) {
				const timestamp = now - i * 60 * 60 * 1000 // Check every hour
				const approximateId = `${user.uid}_log_${Math.floor(timestamp)}`

				try {
					const result = await api.getData(collectionName, approximateId)
					if (result && !result.error) {
						logs.push(result)
					}
				} catch {
					// Document doesn't exist, continue
				}
			}

			log(`Retrieved ${logs.length} log entries using fallback method`)
			return logs
		} else {
			log("Firebase API does not support queryCollection or getData")
			return []
		}
	} catch (error) {
		log("Error getting logs:", error)
		return []
	}
}

/**
 * Add evolution data entry for current user
 * Creates new entries like logs - stores at: evolutionData/{userId_timestamp_random}
 * @param data Evolution data to store
 * @param outputChannel Optional output channel for logging
 */
export async function storeEvolutionData(
	data: Record<string, any>,
	outputChannel?: vscode.OutputChannel,
): Promise<void> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Storing evolution data entry:", JSON.stringify(data))
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for storing evolution data")
			return // Fail silently
		}

		// Get current user to retrieve UID
		const user = await api.getCurrentUser()
		if (!user || !user.uid) {
			log("No authenticated user found for storing evolution data")
			return // Fail silently
		}

		// Add timestamp if not present
		const entryData = {
			timestamp: new Date().toISOString(),
			...data, // Use real data from function parameter
		}

		// Flatten data to ensure all values are primitives
		const flattenedData: Record<string, string | number | boolean | null> = {
			userId: user.uid, // Add userId as queryable field
		}

		for (const [key, value] of Object.entries(entryData)) {
			if (value === null || value === undefined) {
				flattenedData[key] = null
			} else if (typeof value === "object") {
				// Convert objects to JSON strings
				flattenedData[key] = JSON.stringify(value)
			} else if (typeof value === "boolean" || typeof value === "number") {
				// Keep booleans and numbers as-is
				flattenedData[key] = value
			} else {
				// Convert everything else to string
				flattenedData[key] = String(value)
			}
		}

		// Store as new entry: evolutionData/{userId_timestamp_random}
		const documentId = `${user.uid}_evo_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
		const collectionName = `evolutionData`

		await storeData(collectionName, documentId, flattenedData, outputChannel)
		log(`Evolution data entry added successfully: ${collectionName}/${documentId}`)
	} catch (error) {
		// Fail silently - evolution data tracking should never block user actions
		log("Error storing evolution data (non-critical):", error)
	}
}

/**
 * Get latest evolution data entry for current user
 * @param outputChannel Optional output channel for logging
 * @returns Latest evolution data entry or null if not found
 */
export async function getEvolutionData(outputChannel?: vscode.OutputChannel): Promise<any | null> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log("Getting evolution data")
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting evolution data")
			return null
		}

		// Get current user to retrieve UID
		const user = await api.getCurrentUser()
		if (!user || !user.uid) {
			log("No authenticated user found for getting evolution data")
			return null
		}

		const collectionName = `evolutionData`

		// Try to query for the latest entry
		if (typeof api.queryCollection === "function") {
			const entries = await api.queryCollection(collectionName, {
				orderBy: "timestamp",
				orderDirection: "desc",
				limit: 1,
			})

			// Filter by userId
			const userEntries = (entries || []).filter((entry: any) => {
				const docId = entry.id || entry._id || ""
				return docId.startsWith(`${user.uid}_evo_`)
			})

			if (userEntries.length > 0) {
				log("Latest evolution data entry retrieved")
				// Extract data from Firebase Service wrapper
				return userEntries[0].data || userEntries[0]
			}

			log("No evolution data found for user")
			return null
		} else {
			log("Firebase API does not support queryCollection")
			return null
		}
	} catch (error) {
		log("Error getting evolution data:", error)
		return null
	}
}

/**
 * Get all evolution data entries for current user
 * @param limit Maximum number of entries to retrieve (default: 50)
 * @param outputChannel Optional output channel for logging
 * @returns Array of evolution data entries, sorted by timestamp descending (newest first)
 */
export async function getEvolutionHistory(limit: number = 50, outputChannel?: vscode.OutputChannel): Promise<any[]> {
	const log = outputChannel ? createOutputChannelLogger(outputChannel) : () => {}

	try {
		log(`Getting evolution history: limit=${limit}`)
		const api = await getFirebaseAPI(outputChannel)
		if (!api) {
			log("Firebase API not available for getting evolution history")
			return []
		}

		// Get current user to retrieve UID
		const user = await api.getCurrentUser()
		if (!user || !user.uid) {
			log("No authenticated user found for getting evolution history")
			return []
		}

		const collectionName = `evolutionData`

		// Query for all entries
		if (typeof api.queryCollection === "function") {
			const entries = await api.queryCollection(collectionName, {
				orderBy: "timestamp",
				orderDirection: "desc",
				limit,
			})

			// Filter by userId
			const userEntries = (entries || []).filter((entry: any) => {
				const docId = entry.id || entry._id || ""
				return docId.startsWith(`${user.uid}_evo_`)
			})

			log(`Retrieved ${userEntries.length} evolution data entries for user ${user.uid}`)
			return userEntries.map((entry: any) => entry.data || entry)
		} else {
			log("Firebase API does not support queryCollection")
			return []
		}
	} catch (error) {
		log("Error getting evolution history:", error)
		return []
	}
}
