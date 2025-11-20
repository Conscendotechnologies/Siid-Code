/**
 * OpenRouter API Key Service
 *
 * This service handles creating and managing OpenRouter API keys for users.
 * It uses the OpenRouter provisioning API to create keys with spending limits.
 */

import * as vscode from "vscode"
import { logger } from "../../utils/logging"
import { getData, storeData } from "../../utils/firebaseHelper"

export interface CreateKeyParams {
	name: string
	limit?: number
	limit_reset?: "daily" | "weekly" | "monthly" | null
	include_byok_in_limit?: boolean
	expires_at?: string
}

export interface OpenRouterKeyResponse {
	data: {
		hash: string
		name: string
		label: string
		disabled: boolean
		limit: number
		limit_remaining: number
		limit_reset: string | null
		usage: number
		usage_daily: number
		usage_weekly: number
		usage_monthly: number
		usage_byok: number
		usage_byok_daily: number
		usage_byok_weekly: number
		usage_byok_monthly: number
		created_at: string
		updated_at: string
		expires_at: string | null
	}
	key: string
}

export class OpenRouterKeyService {
	private static readonly API_BASE_URL = "https://openrouter.ai/api/v1"
	private provisioningApiKey: string | undefined

	constructor(provisioningApiKey?: string) {
		this.provisioningApiKey = provisioningApiKey
	}

	/**
	 * Set or update the provisioning API key
	 */
	public setProvisioningKey(key: string) {
		this.provisioningApiKey = key
		logger.info("[OpenRouterKeyService] Provisioning API key updated")
	}

	/**
	 * Fetch the default provisioning API key from Firebase
	 */
	public async fetchDefaultProvisioningKey(): Promise<string | undefined> {
		try {
			logger.info("[OpenRouterKeyService] Fetching default provisioning API key from Firebase...")

			// Use Firebase API helper instead of command
			const result = await getData("static-data", "siid-code")

			if (result?.data?.defaultOpenRouterApiKey) {
				const key = result.data.defaultOpenRouterApiKey
				logger.info("[OpenRouterKeyService] Successfully fetched default provisioning API key")
				this.provisioningApiKey = key
				return key
			} else {
				logger.warn("[OpenRouterKeyService] No default provisioning API key found in Firebase")
				return undefined
			}
		} catch (error) {
			logger.error("[OpenRouterKeyService] Failed to fetch default provisioning API key:", error)
			throw new Error(
				`Failed to fetch provisioning API key: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Create a new OpenRouter API key for a user
	 */
	public async createUserApiKey(params: CreateKeyParams): Promise<OpenRouterKeyResponse> {
		if (!this.provisioningApiKey) {
			throw new Error("Provisioning API key not set. Call fetchDefaultProvisioningKey() first.")
		}

		try {
			logger.info(`[OpenRouterKeyService] Creating new API key: ${params.name}`)

			const response = await fetch(`${OpenRouterKeyService.API_BASE_URL}/keys`, {
				method: "POST",
				headers: {
					Authorization: `Bearer ${this.provisioningApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(params),
			})

			if (!response.ok) {
				const errorText = await response.text()
				logger.error(
					`[OpenRouterKeyService] Failed to create API key. Status: ${response.status}, Error: ${errorText}`,
				)
				throw new Error(`Failed to create API key: ${response.status} - ${errorText}`)
			}

			const result: OpenRouterKeyResponse = await response.json()
			logger.info(`[OpenRouterKeyService] Successfully created API key: ${result.data.hash}`)

			return result
		} catch (error) {
			logger.error("[OpenRouterKeyService] Error creating API key:", error)
			throw new Error(
				`Failed to create OpenRouter API key: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	/**
	 * Create a new API key for a user with default settings
	 */
	public async createDefaultUserKey(userId: string, userEmail: string): Promise<OpenRouterKeyResponse> {
		const keyName = `siid-code-${userEmail || userId}-${Date.now()}`

		// Default settings: $10 monthly limit
		const params: CreateKeyParams = {
			name: keyName,
			limit: 10, // $10 USD
			limit_reset: "monthly",
			include_byok_in_limit: true,
		}

		return this.createUserApiKey(params)
	}

	/**
	 * Store the created API key in Firebase for the user
	 */
	public async storeUserApiKey(
		userId: string,
		apiKey: string,
		keyMetadata: OpenRouterKeyResponse["data"],
	): Promise<void> {
		try {
			logger.info(`[OpenRouterKeyService] Storing API key for user: ${userId}`)

			// Use Firebase API helper instead of command
			await storeData(
				"user_api_keys", // collection name
				userId, // document ID
				{
					apiKey,
					keyHash: keyMetadata.hash,
					keyName: keyMetadata.name,
					limit: keyMetadata.limit,
					limitRemaining: keyMetadata.limit_remaining,
					limitReset: keyMetadata.limit_reset,
					createdAt: keyMetadata.created_at,
					expiresAt: keyMetadata.expires_at,
					lastUpdated: new Date().toISOString(),
				},
			)

			logger.info(`[OpenRouterKeyService] Successfully stored API key for user: ${userId}`)
		} catch (error) {
			logger.error("[OpenRouterKeyService] Failed to store user API key:", error)
			throw new Error(`Failed to store API key: ${error instanceof Error ? error.message : String(error)}`)
		}
	}

	/**
	 * Retrieve a user's API key from Firebase
	 */
	public async getUserApiKey(userId: string): Promise<string | undefined> {
		try {
			logger.info(`[OpenRouterKeyService] Retrieving API key for user: ${userId}`)

			// Use Firebase API helper instead of command
			const result = await getData("user_api_keys", userId)

			if (result?.data?.apiKey) {
				logger.info(`[OpenRouterKeyService] Successfully retrieved API key for user: ${userId}`)
				return result.data.apiKey
			} else {
				logger.warn(`[OpenRouterKeyService] No API key found for user: ${userId}`)
				return undefined
			}
		} catch (error) {
			logger.error("[OpenRouterKeyService] Failed to retrieve user API key:", error)
			return undefined
		}
	}

	/**
	 * Complete flow: Fetch provisioning key, create user key, and store it
	 */
	public async setupUserApiKey(userId: string, userEmail: string): Promise<string> {
		try {
			// Step 1: Fetch the default provisioning API key
			await this.fetchDefaultProvisioningKey()

			// Step 2: Check if user already has an API key
			const existingKey = await this.getUserApiKey(userId)
			if (existingKey) {
				logger.info(`[OpenRouterKeyService] User ${userId} already has an API key`)
				return existingKey
			}

			// Step 3: Create a new API key for the user
			const keyResponse = await this.createDefaultUserKey(userId, userEmail)

			// Step 4: Store the API key in Firebase
			await this.storeUserApiKey(userId, keyResponse.key, keyResponse.data)

			logger.info(`[OpenRouterKeyService] Successfully set up API key for user: ${userId}`)
			return keyResponse.key
		} catch (error) {
			logger.error("[OpenRouterKeyService] Failed to setup user API key:", error)
			throw error
		}
	}
}

// Singleton instance
let keyServiceInstance: OpenRouterKeyService | undefined

export function getOpenRouterKeyService(): OpenRouterKeyService {
	if (!keyServiceInstance) {
		keyServiceInstance = new OpenRouterKeyService()
	}
	return keyServiceInstance
}
