/**
 * Firebase Service API Helper
 *
 * This module provides a convenient wrapper around the Firebase Service extension API.
 * It uses the exported API instead of command-based communication for better performance
 * and type safety.
 */

import * as vscode from "vscode"

// Firebase Service extension ID
const FIREBASE_SERVICE_EXTENSION_ID = "ConscendoTechInc.firebase-service"

// Cache for the Firebase API instance
let cachedFirebaseAPI: any = null

/**
 * Get the Firebase Service API
 * @returns Firebase API object or null if extension not available
 */
export async function getFirebaseAPI(): Promise<any | null> {
	// Return cached instance if available
	if (cachedFirebaseAPI) {
		return cachedFirebaseAPI
	}

	try {
		// Get the Firebase Service extension
		const firebaseExt = vscode.extensions.getExtension(FIREBASE_SERVICE_EXTENSION_ID)
		console.log("[FirebaseHelper] Firebase Service extension found:", firebaseExt)

		if (!firebaseExt) {
			console.warn("[FirebaseHelper] Firebase Service extension not found")
			return null
		}

		// Activate the extension if not already activated
		if (!firebaseExt.isActive) {
			console.log("[FirebaseHelper] Activating Firebase Service extension")
			await firebaseExt.activate()
			// Small delay to ensure exports are set
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		// Check if exports are available
		if (!firebaseExt.exports) {
			console.error("[FirebaseHelper] Firebase extension exports are undefined")
			console.log("[FirebaseHelper] Extension packageJSON:", firebaseExt.packageJSON)
			return null
		}

		console.log("[FirebaseHelper] exports methods list ", Object.keys(firebaseExt.exports).join(", "))

		// Get the exported API
		const { firebaseAPI } = firebaseExt.exports

		if (!firebaseAPI) {
			console.error("[FirebaseHelper] Firebase API not exported from extension")
			return null
		}

		// Cache the API instance
		cachedFirebaseAPI = firebaseAPI
		console.log("[FirebaseHelper] Firebase API successfully retrieved and cached")

		return firebaseAPI
	} catch (error) {
		console.error("[FirebaseHelper] Failed to get Firebase API:", error)
		return null
	}
}

/**
 * Check if user is authenticated
 * @returns true if authenticated, false otherwise
 */
export async function isAuthenticated(): Promise<boolean> {
	console.log("[FirebaseHelper] Checking authentication status")
	try {
		const api = await getFirebaseAPI()
		if (!api) {
			return false
		}
		console.log("[FirebaseHelper] api method list ", Object.keys(api).join(", "))

		const isAuth = await api.isAuthenticated()
		console.log("[FirebaseHelper] Authentication status:", isAuth)
		return !!isAuth
	} catch (error) {
		console.error("[FirebaseHelper] Failed to check authentication:", error)
		return false
	}
}

/**
 * Get current user details
 * @returns User object or null
 */
export async function getCurrentUser(): Promise<any | null> {
	try {
		const api = await getFirebaseAPI()
		if (!api) {
			return null
		}

		return await api.getCurrentUser()
	} catch (error) {
		console.error("[FirebaseHelper] Failed to get current user:", error)
		return null
	}
}

/**
 * Store data in Firestore
 * @param collection Collection name
 * @param documentId Document ID
 * @param data Data to store
 * @returns Success status
 */
export async function storeData(
	collection: string,
	documentId: string,
	data: Record<string, any>,
): Promise<{ success: boolean; error?: string }> {
	try {
		const api = await getFirebaseAPI()
		if (!api) {
			return { success: false, error: "Firebase API not available" }
		}

		return await api.storeData(collection, documentId, data)
	} catch (error) {
		console.error("[FirebaseHelper] Failed to store data:", error)
		return {
			success: false,
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * Get data from Firestore
 * @param collection Collection name
 * @param documentId Document ID
 * @returns Document data or error object
 */
export async function getData(collection: string, documentId: string): Promise<any> {
	try {
		const api = await getFirebaseAPI()
		if (!api) {
			return { error: "Firebase API not available" }
		}

		return await api.getData(collection, documentId)
	} catch (error) {
		console.error("[FirebaseHelper] Failed to get data:", error)
		return {
			error: error instanceof Error ? error.message : String(error),
		}
	}
}

/**
 * Sign out the current user
 */
export async function logout(): Promise<void> {
	try {
		const api = await getFirebaseAPI()
		if (!api) {
			console.warn("[FirebaseHelper] Cannot logout - Firebase API not available")
			return
		}

		await api.logout()
		console.log("[FirebaseHelper] User logged out successfully")
	} catch (error) {
		console.error("[FirebaseHelper] Failed to logout:", error)
		throw error
	}
}

/**
 * Listen to authentication state changes
 * @param callback Function to call when auth state changes
 * @returns Disposable to unsubscribe
 */
export async function onAuthStateChanged(
	callback: (isAuthenticated: boolean) => void,
): Promise<vscode.Disposable | null> {
	try {
		const api = await getFirebaseAPI()
		if (!api) {
			console.warn("[FirebaseHelper] Cannot listen to auth changes - Firebase API not available")
			return null
		}

		// Firebase API's onAuthStateChanged should return a disposable
		const disposable = api.onAuthStateChanged(callback)
		return disposable
	} catch (error) {
		console.error("[FirebaseHelper] Failed to listen to auth state changes:", error)
		return null
	}
}

/**
 * Clear the cached Firebase API instance
 * Useful when the Firebase Service extension is updated or reloaded
 */
export function clearFirebaseAPICache(): void {
	cachedFirebaseAPI = null
	console.log("[FirebaseHelper] Firebase API cache cleared")
}

/**
 * Login to Firebase
 */
export async function onFirebaseLogin(): Promise<void> {
	try {
		const api = await getFirebaseAPI()
		if (!api) {
			throw new Error("Firebase API not available")
		}

		// Assuming the API has a login method, but since login is via command, perhaps call the command
		// But since this is a helper, perhaps just call the command
		await vscode.commands.executeCommand("firebase-service.signIn")
		console.log("[FirebaseHelper] Firebase login initiated")
	} catch (error) {
		console.error("[FirebaseHelper] Failed to login:", error)
		throw error
	}
}

/**
 * Logout from Firebase
 */
export async function onFirebaseLogout(): Promise<void> {
	await logout()
}
