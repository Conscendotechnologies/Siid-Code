# Firebase Service API Integration Guide

This guide explains how to use the Firebase Service API in your VS Code extension.

## Overview

The Firebase Service extension (`ConscendoTechInc.firebase-service`) provides authentication and Firestore data access functionality. This extension exports an API that you can use instead of executing VS Code commands.

## Prerequisites

Add the Firebase Service extension as a dependency in your `package.json`:

```json
{
	"extensionDependencies": ["ConscendoTechInc.firebase-service"]
}
```

## Using the Firebase Helper

We've created a helper module (`src/utils/firebaseHelper.ts`) that wraps the Firebase Service API for easier use throughout the extension.

### Import the Helper

```typescript
import {
	getFirebaseAPI,
	isAuthenticated,
	getCurrentUser,
	storeData,
	getData,
	logout,
	onAuthStateChanged,
	clearFirebaseAPICache,
	onFirebaseLogin,
	onFirebaseLogout,
} from "../utils/firebaseHelper"
```

### Available Functions

#### 1. Check Authentication Status

```typescript
// Check if user is authenticated
const isLoggedIn = await isAuthenticated()

if (isLoggedIn) {
	console.log("User is logged in")
} else {
	console.log("User is not logged in")
}
```

#### 2. Get Current User

```typescript
// Get the current logged-in user
const user = await getCurrentUser()

if (user) {
	console.log("User ID:", user.uid)
	console.log("Email:", user.email)
	console.log("Display Name:", user.displayName)
	console.log("Photo URL:", user.photoURL)
}
```

#### 3. Store Data in Firestore

```typescript
// Store data in a Firestore collection
await storeData(
	"user_api_keys", // collection name
	"user123", // document ID
	{
		// data to store
		apiKey: "sk-...",
		createdAt: new Date().toISOString(),
		limit: 10,
	},
)
```

#### 4. Retrieve Data from Firestore

```typescript
// Retrieve data from Firestore
const result = await getData("user_api_keys", "user123")

if (result?.data) {
	console.log("API Key:", result.data.apiKey)
	console.log("Created:", result.data.createdAt)
}
```

#### 5. Sign Out

```typescript
// Sign out the current user
await logout()
console.log("User signed out")
```

#### 6. Login to Firebase

```typescript
// Initiate Firebase login
await onFirebaseLogin()
console.log("Firebase login initiated")
```

#### 7. Logout from Firebase

```typescript
// Logout from Firebase
await onFirebaseLogout()
console.log("Firebase logout completed")
```

#### 8. Listen to Auth State Changes

```typescript
// Listen for authentication state changes
const unsubscribe = await onAuthStateChanged((user) => {
	if (user) {
		console.log("User signed in:", user.uid)
	} else {
		console.log("User signed out")
	}
})

// Later, to stop listening:
if (unsubscribe) {
	unsubscribe()
}
```

#### 9. Clear API Cache

```typescript
// Clear the cached Firebase API instance
// Useful when resetting extension state
clearFirebaseAPICache()
```

## Migration from Commands

If you're migrating from the command-based approach, here's how to convert:

### Before (Using Commands)

```typescript
// Old way - using VS Code commands
const result = await vscode.commands.executeCommand<any>("firebase-service.retrieveData", "user_api_keys", "user123")

if (result?.data?.apiKey) {
	console.log("API Key:", result.data.apiKey)
}
```

### After (Using API Helper)

```typescript
// New way - using Firebase API helper
const result = await getData("user_api_keys", "user123")

if (result?.data?.apiKey) {
	console.log("API Key:", result.data.apiKey)
}
```

### Benefits of API Helper

1. **Better Performance**: Direct API calls without command overhead
2. **Type Safety**: Full TypeScript support with proper interfaces
3. **More Reliable**: No command registration timing issues
4. **Cleaner Code**: Simpler function calls instead of executeCommand

## Real-World Examples

### Example 1: User API Key Management

```typescript
import { isAuthenticated, getCurrentUser, getData, storeData } from "../utils/firebaseHelper"

async function setupUserApiKey() {
	// Check authentication
	if (!(await isAuthenticated())) {
		throw new Error("User not authenticated")
	}

	// Get current user
	const user = await getCurrentUser()
	if (!user) {
		throw new Error("No user found")
	}

	// Check for existing key
	const existing = await getData("user_api_keys", user.uid)
	if (existing?.data?.apiKey) {
		return existing.data.apiKey
	}

	// Create and store new key
	const newKey = await createApiKey(user.email)
	await storeData("user_api_keys", user.uid, {
		apiKey: newKey,
		createdAt: new Date().toISOString(),
		email: user.email,
	})

	return newKey
}
```

### Example 2: Auth State in Webview Provider

```typescript
import { isAuthenticated, onAuthStateChanged } from "../utils/firebaseHelper"

class MyWebviewProvider {
	private cachedAuthState: boolean | undefined
	private authUnsubscribe: (() => void) | undefined

	constructor() {
		// Listen for auth changes
		this.setupAuthListener()
	}

	private async setupAuthListener() {
		this.authUnsubscribe = await onAuthStateChanged((user) => {
			this.cachedAuthState = !!user
			// Update UI based on auth state
			this.updateWebview()
		})
	}

	async checkAuth(): Promise<boolean> {
		// Use cached state if available
		if (this.cachedAuthState !== undefined) {
			return this.cachedAuthState
		}

		// Otherwise check current state
		this.cachedAuthState = await isAuthenticated()
		return this.cachedAuthState
	}

	resetState() {
		// Clear cache when resetting
		this.cachedAuthState = undefined
		if (this.authUnsubscribe) {
			this.authUnsubscribe()
		}
	}
}
```

### Example 3: Fetching Default Configuration

```typescript
import { getData } from "../utils/firebaseHelper"

async function getDefaultConfig(): Promise<string> {
	// Fetch default configuration from Firestore
	const result = await getData("static-data", "siid-code")

	if (!result?.data?.defaultOpenRouterApiKey) {
		throw new Error("Default API key not found in Firebase")
	}

	return result.data.defaultOpenRouterApiKey
}
```

## Error Handling

Always wrap Firebase operations in try-catch blocks:

```typescript
try {
	const result = await getData("user_api_keys", userId)
	if (result?.data) {
		// Handle data
	}
} catch (error) {
	console.error("Failed to fetch data:", error)
	// Show error to user
	vscode.window.showErrorMessage("Failed to retrieve data from Firebase")
}
```

## Best Practices

1. **Cache Authentication State**: Store auth state in memory to avoid repeated checks
2. **Error Handling**: Always handle potential errors from Firebase operations
3. **Type Safety**: Use TypeScript interfaces for your Firestore data structures
4. **Resource Cleanup**: Unsubscribe from auth listeners when no longer needed
5. **Logging**: Use a logger to track Firebase operations for debugging

## Direct API Access

If you need to access the Firebase API directly (not recommended unless necessary):

```typescript
import { getFirebaseAPI } from "../utils/firebaseHelper"

const firebaseAPI = await getFirebaseAPI()
if (firebaseAPI) {
	// Access any Firebase Service API method
	const user = await firebaseAPI.getCurrentUser()
	// ... custom operations
}
```

## Troubleshooting

### Firebase Service Not Available

If you get an error that the Firebase Service is not available:

1. Ensure the extension is listed in `extensionDependencies`
2. Verify the Firebase Service extension is installed
3. Check that the extension has activated before calling the API

### Cache Issues

If you're experiencing stale authentication state:

```typescript
import { clearFirebaseAPICache } from "../utils/firebaseHelper"

// Clear the cache and re-check
clearFirebaseAPICache()
const freshAuthState = await isAuthenticated()
```

## Additional Resources

- Firebase Service Extension: [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ConscendoTechInc.firebase-service)
- Firebase Documentation: [firebase.google.com/docs](https://firebase.google.com/docs)
- Firestore Data Model: [firebase.google.com/docs/firestore](https://firebase.google.com/docs/firestore)
