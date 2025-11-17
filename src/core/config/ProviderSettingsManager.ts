import { ExtensionContext } from "vscode"
import { z, ZodError } from "zod"
import deepEqual from "fast-deep-equal"

import {
	type ProviderSettingsWithId,
	providerSettingsWithIdSchema,
	discriminatedProviderSettingsWithIdSchema,
	isSecretStateKey,
	ProviderSettingsEntry,
	DEFAULT_CONSECUTIVE_MISTAKE_LIMIT,
} from "@siid-code/types"
import { TelemetryService } from "@siid-code/telemetry"

import { Mode, modes } from "../../shared/modes"
import { logger } from "../../utils/logging"

export interface SyncCloudProfilesResult {
	hasChanges: boolean
	activeProfileChanged: boolean
	activeProfileId: string
}

export const providerProfilesSchema = z.object({
	currentApiConfigName: z.string(),
	apiConfigs: z.record(z.string(), providerSettingsWithIdSchema),
	modeApiConfigs: z.record(z.string(), z.string()).optional(),
	cloudProfileIds: z.array(z.string()).optional(),
	migrations: z
		.object({
			rateLimitSecondsMigrated: z.boolean().optional(),
			diffSettingsMigrated: z.boolean().optional(),
			openAiHeadersMigrated: z.boolean().optional(),
			consecutiveMistakeLimitMigrated: z.boolean().optional(),
			todoListEnabledMigrated: z.boolean().optional(),
			useFreeModelsMigrated: z.boolean().optional(),
		})
		.optional(),
})

export type ProviderProfiles = z.infer<typeof providerProfilesSchema>

export class ProviderSettingsManager {
	private static readonly SCOPE_PREFIX = "roo_cline_config_"
	private readonly defaultConfigId = this.generateId()

	// Free model config IDs
	private readonly salesforceAgentFreeId = "salesforce-agent-free"
	private readonly salesforceAgentPaidId = "salesforce-agent-paid"
	private readonly codeFreeId = "code-free"
	private readonly codePaidId = "code-paid"
	private readonly orchestratorFreeId = "orchestrator-free"
	private readonly orchestratorPaidId = "orchestrator-paid"

	private readonly defaultModeApiConfigs: Record<string, string> = Object.fromEntries(
		modes.map((mode) => {
			if (mode.slug === "salesforce-agent") {
				// Use the actual ID constant
				return [mode.slug, this.salesforceAgentPaidId]
			}
			if (mode.slug === "code") {
				return [mode.slug, this.codePaidId]
			}
			if (mode.slug === "orchestrator") {
				return [mode.slug, this.orchestratorPaidId]
			}
			return [mode.slug, this.defaultConfigId]
		}),
	)

	private readonly defaultProviderProfiles: ProviderProfiles = {
		currentApiConfigName: "default",
		apiConfigs: {
			default: { id: this.defaultConfigId },

			// salesforce-agent configs
			[this.salesforceAgentPaidId]: {
				id: this.salesforceAgentPaidId,
				apiProvider: "openrouter",
				apiModelId: "x-ai/grok-code-fast-1",
				// apiKey will be set to PAID TIER key from Firebase
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},
			[this.salesforceAgentFreeId]: {
				id: this.salesforceAgentFreeId,
				apiProvider: "openrouter",
				openRouterModelId: "z-ai/glm-4.5-air:free",
				// openRouterApiKey will be set to FREE TIER key from Firebase
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},

			// code mode configs
			[this.codeFreeId]: {
				id: this.codeFreeId,
				apiProvider: "openrouter",
				openRouterModelId: "z-ai/glm-4.5-air:free",
				// openRouterApiKey will be set to FREE TIER key from Firebase
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},
			[this.codePaidId]: {
				id: this.codePaidId,
				apiProvider: "openrouter",
				openRouterModelId: "z-ai/glm-4.5",
				// openRouterApiKey will be set to PAID TIER key from Firebase
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},
			[this.orchestratorFreeId]: {
				id: this.orchestratorFreeId,
				apiProvider: "openrouter",
				openRouterModelId: "openrouter/polaris-alpha",
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},
			[this.orchestratorPaidId]: {
				id: this.orchestratorPaidId,
				apiProvider: "openrouter",
				openRouterModelId: "x-ai/grok-code-fast-1",
				rateLimitSeconds: 0,
				diffEnabled: true,
				fuzzyMatchThreshold: 1.0,
				consecutiveMistakeLimit: 3,
				todoListEnabled: true,
			},
		},
		modeApiConfigs: this.defaultModeApiConfigs,
		migrations: {
			rateLimitSecondsMigrated: true, // Mark as migrated on fresh installs
			diffSettingsMigrated: true, // Mark as migrated on fresh installs
			openAiHeadersMigrated: true, // Mark as migrated on fresh installs
			consecutiveMistakeLimitMigrated: true, // Mark as migrated on fresh installs
			todoListEnabledMigrated: true, // Mark as migrated on fresh installs
			useFreeModelsMigrated: true, // Mark as migrated on fresh installs
		},
	}

	private readonly context: ExtensionContext

	constructor(context: ExtensionContext) {
		this.context = context

		logger.info(
			`ProviderSettingsManager.constructor: defaultModeApiConfigs=${JSON.stringify(this.defaultModeApiConfigs)}`,
		)
		logger.info(
			`ProviderSettingsManager.constructor: defaultProviderProfiles.modeApiConfigs=${JSON.stringify(this.defaultProviderProfiles.modeApiConfigs)}`,
		)

		// TODO: We really shouldn't have async methods in the constructor.
		this.initialize().catch(console.error)
	}

	public generateId() {
		return Math.random().toString(36).substring(2, 15)
	}

	// Synchronize readConfig/writeConfig operations to avoid data loss.
	private _lock = Promise.resolve()
	private lock<T>(cb: () => Promise<T>) {
		const next = this._lock.then(cb)
		this._lock = next.catch(() => {}) as Promise<void>
		return next
	}

	/**
	 * Initialize config if it doesn't exist and run migrations.
	 */
	public async initialize() {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()

				logger.info(
					`ProviderSettingsManager.initialize: existing providerProfiles=${JSON.stringify(providerProfiles)}`,
				)

				if (!providerProfiles) {
					logger.info(`ProviderSettingsManager.initialize: storing defaultProviderProfiles`)
					await this.store(this.defaultProviderProfiles)
					return
				}

				let isDirty = false

				// Migrate existing installs to have per-mode API config map
				if (!providerProfiles.modeApiConfigs) {
					// Use the currently selected config for all modes initially
					const currentName = providerProfiles.currentApiConfigName
					const seedId =
						providerProfiles.apiConfigs[currentName]?.id ??
						Object.values(providerProfiles.apiConfigs)[0]?.id ??
						this.defaultConfigId
					providerProfiles.modeApiConfigs = Object.fromEntries(modes.map((m) => [m.slug, seedId]))
					isDirty = true
				}

				// Ensure all configs have IDs.
				for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
					if (!apiConfig.id) {
						apiConfig.id = this.generateId()
						isDirty = true
					}
				}

				// Ensure migrations field exists
				if (!providerProfiles.migrations) {
					providerProfiles.migrations = {
						rateLimitSecondsMigrated: false,
						diffSettingsMigrated: false,
						openAiHeadersMigrated: false,
						consecutiveMistakeLimitMigrated: false,
						todoListEnabledMigrated: false,
					} // Initialize with default values
					isDirty = true
				}

				if (!providerProfiles.migrations.rateLimitSecondsMigrated) {
					await this.migrateRateLimitSeconds(providerProfiles)
					providerProfiles.migrations.rateLimitSecondsMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.diffSettingsMigrated) {
					await this.migrateDiffSettings(providerProfiles)
					providerProfiles.migrations.diffSettingsMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.openAiHeadersMigrated) {
					await this.migrateOpenAiHeaders(providerProfiles)
					providerProfiles.migrations.openAiHeadersMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.consecutiveMistakeLimitMigrated) {
					await this.migrateConsecutiveMistakeLimit(providerProfiles)
					providerProfiles.migrations.consecutiveMistakeLimitMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.todoListEnabledMigrated) {
					await this.migrateTodoListEnabled(providerProfiles)
					providerProfiles.migrations.todoListEnabledMigrated = true
					isDirty = true
				}

				if (!providerProfiles.migrations.useFreeModelsMigrated) {
					await this.migrateUseFreeModels(providerProfiles)
					providerProfiles.migrations.useFreeModelsMigrated = true
					isDirty = true
				}

				if (isDirty) {
					await this.store(providerProfiles)
				}

				// Fetch and update API keys from Firebase
				await this.updateApiKeysFromFirebase()
			})
		} catch (error) {
			throw new Error(`Failed to initialize config: ${error}`)
		}
	}

	/**
	 * Fetch API keys from Firebase for free and paid tiers.
	 * TODO: Implement Firebase integration - call the extension command to fetch keys
	 * For now, returns placeholder keys that will be replaced when Firebase is integrated.
	 *
	 * Structure: One provider, two API keys (free tier and paid tier)
	 */
	private async fetchApiKeysFromFirebase(): Promise<{
		freeApiKey: string | undefined // Single API key for free tier
		paidApiKey: string | undefined // Single API key for paid tier
	}> {
		try {
			// TODO: Replace with actual Firebase command execution
			// Example: const result = await vscode.commands.executeCommand('extension.fetchFirebaseApiKeys')

			logger.info("[ProviderSettingsManager] Fetching API keys from Firebase...")

			// PLACEHOLDER: Return empty keys for now
			// When Firebase integration is ready, this will fetch:
			// - freeApiKey: API key for free tier models (rate-limited, $0 cost)
			// - paidApiKey: API key for paid tier models (higher rate limits, costs money)
			return {
				freeApiKey: "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", // e.g., "sk-or-v1-free-tier-abc123..."
				paidApiKey: "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", // e.g., "sk-or-v1-paid-tier-xyz789..."
			}
		} catch (error) {
			logger.error(`[ProviderSettingsManager] Failed to fetch API keys from Firebase: ${error}`)
			return {
				freeApiKey: undefined,
				paidApiKey: undefined,
			}
		}
	}

	/**
	 * Update API configs with Firebase API keys.
	 * Free configs get the free tier key, paid configs get the paid tier key.
	 * Call this method when toggling useFreeModels or during initialization.
	 */
	public async updateApiKeysFromFirebase() {
		try {
			const { freeApiKey, paidApiKey } = await this.fetchApiKeysFromFirebase()

			const providerProfiles = await this.load()
			if (!providerProfiles) {
				logger.warn("[ProviderSettingsManager] No provider profiles found")
				return
			}

			let isDirty = false

			// Update all FREE configs with the free tier API key
			// Free configs use OpenRouter with :free suffix models
			const salesforceAgentFreeConfig = Object.values(providerProfiles.apiConfigs).find(
				(config) => config.id === this.salesforceAgentFreeId,
			)
			if (salesforceAgentFreeConfig && freeApiKey) {
				salesforceAgentFreeConfig.openRouterApiKey = freeApiKey
				isDirty = true
			}

			const codeFreeConfig = Object.values(providerProfiles.apiConfigs).find(
				(config) => config.id === this.codeFreeId,
			)
			if (codeFreeConfig && freeApiKey) {
				codeFreeConfig.openRouterApiKey = freeApiKey
				isDirty = true
			}

			const orchestratorFreeConfig = Object.values(providerProfiles.apiConfigs).find(
				(config) => config.id === this.orchestratorFreeId,
			)
			if (orchestratorFreeConfig && freeApiKey) {
				orchestratorFreeConfig.cerebrasApiKey = freeApiKey
				isDirty = true
			}

			// Update all PAID configs with the paid tier API key
			// Paid configs use Anthropic and OpenRouter
			const salesforceAgentPaidConfig = Object.values(providerProfiles.apiConfigs).find(
				(config) => config.id === this.salesforceAgentPaidId,
			)
			if (salesforceAgentPaidConfig && paidApiKey) {
				salesforceAgentPaidConfig.apiKey = paidApiKey
				isDirty = true
			}

			const codePaidConfig = Object.values(providerProfiles.apiConfigs).find(
				(config) => config.id === this.codePaidId,
			)
			if (codePaidConfig && paidApiKey) {
				codePaidConfig.openRouterApiKey = paidApiKey
				isDirty = true
			}

			const orchestratorPaidConfig = Object.values(providerProfiles.apiConfigs).find(
				(config) => config.id === this.orchestratorPaidId,
			)
			if (orchestratorPaidConfig && paidApiKey) {
				orchestratorPaidConfig.openRouterApiKey = paidApiKey
				isDirty = true
			}
			if (isDirty) {
				await this.store(providerProfiles)
				logger.info(
					"[ProviderSettingsManager] Updated API configs with Firebase keys (free tier and paid tier)",
				)
			} else if (!freeApiKey && !paidApiKey) {
				logger.info("[ProviderSettingsManager] No API keys fetched from Firebase (using placeholders)")
			}
		} catch (error) {
			logger.error(`[ProviderSettingsManager] Failed to update API keys: ${error}`)
		}
	}

	private async migrateRateLimitSeconds(providerProfiles: ProviderProfiles) {
		try {
			let rateLimitSeconds: number | undefined

			try {
				rateLimitSeconds = await this.context.globalState.get<number>("rateLimitSeconds")
			} catch (error) {
				console.error("[MigrateRateLimitSeconds] Error getting global rate limit:", error)
			}

			if (rateLimitSeconds === undefined) {
				// Failed to get the existing value, use the default.
				rateLimitSeconds = 0
			}

			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.rateLimitSeconds === undefined) {
					apiConfig.rateLimitSeconds = rateLimitSeconds
				}
			}
		} catch (error) {
			console.error(`[MigrateRateLimitSeconds] Failed to migrate rate limit settings:`, error)
		}
	}

	private async migrateDiffSettings(providerProfiles: ProviderProfiles) {
		try {
			let diffEnabled: boolean | undefined
			let fuzzyMatchThreshold: number | undefined

			try {
				diffEnabled = await this.context.globalState.get<boolean>("diffEnabled")
				fuzzyMatchThreshold = await this.context.globalState.get<number>("fuzzyMatchThreshold")
			} catch (error) {
				console.error("[MigrateDiffSettings] Error getting global diff settings:", error)
			}

			if (diffEnabled === undefined) {
				// Failed to get the existing value, use the default.
				diffEnabled = true
			}

			if (fuzzyMatchThreshold === undefined) {
				// Failed to get the existing value, use the default.
				fuzzyMatchThreshold = 1.0
			}

			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.diffEnabled === undefined) {
					apiConfig.diffEnabled = diffEnabled
				}
				if (apiConfig.fuzzyMatchThreshold === undefined) {
					apiConfig.fuzzyMatchThreshold = fuzzyMatchThreshold
				}
			}
		} catch (error) {
			console.error(`[MigrateDiffSettings] Failed to migrate diff settings:`, error)
		}
	}

	private async migrateOpenAiHeaders(providerProfiles: ProviderProfiles) {
		try {
			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				// Use type assertion to access the deprecated property safely
				const configAny = apiConfig as any

				// Check if openAiHostHeader exists but openAiHeaders doesn't
				if (
					configAny.openAiHostHeader &&
					(!apiConfig.openAiHeaders || Object.keys(apiConfig.openAiHeaders || {}).length === 0)
				) {
					// Create the headers object with the Host value
					apiConfig.openAiHeaders = { Host: configAny.openAiHostHeader }

					// Delete the old property to prevent re-migration
					// This prevents the header from reappearing after deletion
					configAny.openAiHostHeader = undefined
				}
			}
		} catch (error) {
			console.error(`[MigrateOpenAiHeaders] Failed to migrate OpenAI headers:`, error)
		}
	}

	private async migrateConsecutiveMistakeLimit(providerProfiles: ProviderProfiles) {
		try {
			for (const [name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.consecutiveMistakeLimit == null) {
					apiConfig.consecutiveMistakeLimit = DEFAULT_CONSECUTIVE_MISTAKE_LIMIT
				}
			}
		} catch (error) {
			console.error(`[MigrateConsecutiveMistakeLimit] Failed to migrate consecutive mistake limit:`, error)
		}
	}

	private async migrateTodoListEnabled(providerProfiles: ProviderProfiles) {
		try {
			for (const [_name, apiConfig] of Object.entries(providerProfiles.apiConfigs)) {
				if (apiConfig.todoListEnabled === undefined) {
					apiConfig.todoListEnabled = true
				}
			}
		} catch (error) {
			console.error(`[MigrateTodoListEnabled] Failed to migrate todo list enabled setting:`, error)
		}
	}

	private async migrateUseFreeModels(providerProfiles: ProviderProfiles) {
		try {
			// Check if user has existing configs (indicating existing user)
			const hasExistingConfigs = Object.keys(providerProfiles.apiConfigs).length > 1 // More than just 'default'

			// Get current global setting
			let useFreeModels: boolean | undefined
			try {
				useFreeModels = await this.context.globalState.get<boolean>("useFreeModels")
			} catch (error) {
				console.error("[MigrateUseFreeModels] Error getting global useFreeModels setting:", error)
			}

			// Only set default if not already set
			if (useFreeModels === undefined) {
				// Existing users: keep paid models (false)
				// New users: default to free models (true)
				useFreeModels = !hasExistingConfigs
				await this.context.globalState.update("useFreeModels", useFreeModels)
				logger.info(
					`[MigrateUseFreeModels] Set useFreeModels=${useFreeModels} for ${hasExistingConfigs ? "existing" : "new"} user`,
				)
			}
		} catch (error) {
			console.error(`[MigrateUseFreeModels] Failed to migrate useFreeModels setting:`, error)
		}
	}

	/**
	 * List all available configs with metadata.
	 */
	public async listConfig(): Promise<ProviderSettingsEntry[]> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()

				const entries = Object.entries(providerProfiles.apiConfigs).map(([name, apiConfig]) => ({
					name,
					id: apiConfig.id || "",
					apiProvider: apiConfig.apiProvider,
				}))

				logger.info(`[ProviderSettingsManager] listConfig returning ${entries.length} entries`)
				console.log(
					"[ProviderSettingsManager] listConfig entries:",
					entries.map((e) => `${e.name} (id: ${e.id})`).join(", "),
				)

				return entries
			})
		} catch (error) {
			throw new Error(`Failed to list configs: ${error}`)
		}
	}

	/**
	 * Save a config with the given name.
	 * Preserves the ID from the input 'config' object if it exists,
	 * otherwise generates a new one (for creation scenarios).
	 */
	public async saveConfig(name: string, config: ProviderSettingsWithId): Promise<string> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				// Preserve the existing ID if this is an update to an existing config.
				const existingId = providerProfiles.apiConfigs[name]?.id
				const id = config.id || existingId || this.generateId()

				// Filter out settings from other providers.
				const filteredConfig = discriminatedProviderSettingsWithIdSchema.parse(config)
				providerProfiles.apiConfigs[name] = { ...filteredConfig, id }
				await this.store(providerProfiles)
				return id
			})
		} catch (error) {
			throw new Error(`Failed to save config: ${error}`)
		}
	}

	public async getProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				let name: string
				let providerSettings: ProviderSettingsWithId

				if ("name" in params) {
					name = params.name

					if (!providerProfiles.apiConfigs[name]) {
						throw new Error(`Config with name '${name}' not found`)
					}

					providerSettings = providerProfiles.apiConfigs[name]
				} else {
					const id = params.id

					const entry = Object.entries(providerProfiles.apiConfigs).find(
						([_, apiConfig]) => apiConfig.id === id,
					)

					if (!entry) {
						throw new Error(`Config with ID '${id}' not found`)
					}

					name = entry[0]
					providerSettings = entry[1]
				}

				return { name, ...providerSettings }
			})
		} catch (error) {
			throw new Error(`Failed to get profile: ${error instanceof Error ? error.message : error}`)
		}
	}

	/**
	 * Activate a profile by name or ID.
	 */
	public async activateProfile(
		params: { name: string } | { id: string },
	): Promise<ProviderSettingsWithId & { name: string }> {
		const { name, ...providerSettings } = await this.getProfile(params)

		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				providerProfiles.currentApiConfigName = name
				await this.store(providerProfiles)
				return { name, ...providerSettings }
			})
		} catch (error) {
			throw new Error(`Failed to activate profile: ${error instanceof Error ? error.message : error}`)
		}
	}

	/**
	 * Delete a config by name.
	 */
	public async deleteConfig(name: string) {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()

				if (!providerProfiles.apiConfigs[name]) {
					throw new Error(`Config '${name}' not found`)
				}

				if (Object.keys(providerProfiles.apiConfigs).length === 1) {
					throw new Error(`Cannot delete the last remaining configuration`)
				}

				delete providerProfiles.apiConfigs[name]
				await this.store(providerProfiles)
			})
		} catch (error) {
			throw new Error(`Failed to delete config: ${error}`)
		}
	}

	/**
	 * Check if a config exists by name.
	 */
	public async hasConfig(name: string) {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				return name in providerProfiles.apiConfigs
			})
		} catch (error) {
			throw new Error(`Failed to check config existence: ${error}`)
		}
	}

	/**
	 * Set the API config for a specific mode.
	 */
	public async setModeConfig(mode: Mode, configId: string) {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				// Ensure the per-mode config map exists
				if (!providerProfiles.modeApiConfigs) {
					providerProfiles.modeApiConfigs = {}
				}
				// Assign the chosen config ID to this mode
				providerProfiles.modeApiConfigs[mode] = configId
				console.log(`[ProviderSettingsManager] setModeConfig: mode=${mode}, configId=${configId}`)
				await this.store(providerProfiles)
			})
		} catch (error) {
			throw new Error(`Failed to set mode config: ${error}`)
		}
	}

	/**
	 * Get the API config ID for a specific mode.
	 */
	public async getModeConfigId(mode: Mode) {
		try {
			return await this.lock(async () => {
				const { modeApiConfigs } = await this.load()
				const configId = modeApiConfigs?.[mode]
				logger.info(
					`ProviderSettingsManager.getModeConfigId: mode=${mode}, configId=${configId}, modeApiConfigs=${JSON.stringify(modeApiConfigs)}`,
				)
				console.log(`[ProviderSettingsManager] getModeConfigId: mode=${mode}, configId=${configId}`)
				return configId
			})
		} catch (error) {
			throw new Error(`Failed to get mode config: ${error}`)
		}
	}

	public async export() {
		try {
			return await this.lock(async () => {
				const profiles = providerProfilesSchema.parse(await this.load())
				const configs = profiles.apiConfigs
				for (const name in configs) {
					// Avoid leaking properties from other providers.
					configs[name] = discriminatedProviderSettingsWithIdSchema.parse(configs[name])
				}
				return profiles
			})
		} catch (error) {
			throw new Error(`Failed to export provider profiles: ${error}`)
		}
	}

	public async import(providerProfiles: ProviderProfiles) {
		try {
			return await this.lock(() => this.store(providerProfiles))
		} catch (error) {
			throw new Error(`Failed to import provider profiles: ${error}`)
		}
	}

	/**
	 * Reset provider profiles by deleting them from secrets.
	 */
	public async resetAllConfigs() {
		return await this.lock(async () => {
			await this.context.secrets.delete(this.secretsKey)
		})
	}

	private get secretsKey() {
		return `${ProviderSettingsManager.SCOPE_PREFIX}api_config`
	}

	private async load(): Promise<ProviderProfiles> {
		try {
			const content = await this.context.secrets.get(this.secretsKey)

			if (!content) {
				logger.info("[ProviderSettingsManager] No saved configs, returning defaults")
				console.log("[ProviderSettingsManager] No saved configs, returning defaults")
				console.log(
					"[ProviderSettingsManager] Default config names:",
					Object.keys(this.defaultProviderProfiles.apiConfigs),
				)
				return this.defaultProviderProfiles
			}

			const providerProfiles = providerProfilesSchema
				.extend({
					apiConfigs: z.record(z.string(), z.any()),
				})
				.parse(JSON.parse(content))

			const apiConfigs = Object.entries(providerProfiles.apiConfigs).reduce(
				(acc, [key, apiConfig]) => {
					const result = providerSettingsWithIdSchema.safeParse(apiConfig)
					return result.success ? { ...acc, [key]: result.data } : acc
				},
				{} as Record<string, ProviderSettingsWithId>,
			)

			logger.info(`[ProviderSettingsManager] Loaded ${Object.keys(apiConfigs).length} saved configs from secrets`)
			console.log("[ProviderSettingsManager] Saved config names:", Object.keys(apiConfigs))

			// Migrate old ids to new ids
			const migrations = {
				"anthropic-claude-config-id": "anthropic-claude-config",
				"openai-gpt-config-id": "openai-gpt-config",
				"anthropic-haiku-config-id": "anthropic-haiku",
			}
			for (const [oldId, newId] of Object.entries(migrations)) {
				if (apiConfigs[oldId]) {
					apiConfigs[newId] = { ...apiConfigs[oldId], id: newId }
					delete apiConfigs[oldId]
				}
			}

			// Merge with default predefined configs to ensure they're always available
			const mergedApiConfigs = {
				...this.defaultProviderProfiles.apiConfigs, // Predefined configs first
				...apiConfigs, // User configs override defaults if they have the same name
			}

			logger.info(`[ProviderSettingsManager] After merge: ${Object.keys(mergedApiConfigs).length} total configs`)
			console.log("[ProviderSettingsManager] Merged config names:", Object.keys(mergedApiConfigs))
			console.log(
				"[ProviderSettingsManager] Merged config IDs:",
				Object.values(mergedApiConfigs).map((c: any) => c.id),
			)

			// Find a config with API keys to populate predefined configs
			const configWithKeys = Object.values(mergedApiConfigs).find((config) => {
				return (
					(config && (config as any).openRouterApiKey) ||
					(config as any).anthropicApiKey ||
					(config as any).openAIApiKey
				)
			})

			if (configWithKeys) {
				const keysToCopy = [
					"openRouterApiKey",
					"anthropicApiKey",
					"openAIApiKey",
					"openRouterModelId",
					"anthropicModelId",
					"openAIModelId",
				]
				keysToCopy.forEach((key) => {
					if ((configWithKeys as any)[key] && !(mergedApiConfigs["salesforce-agent-paid"] as any)[key]) {
						;(mergedApiConfigs["salesforce-agent-paid"] as any)[key] = (configWithKeys as any)[key]
						logger.info(`ProviderSettingsManager.load: copied ${key} to salesforce-agent-paid`)
					}
					if ((configWithKeys as any)[key] && !(mergedApiConfigs["code-paid"] as any)[key]) {
						;(mergedApiConfigs["code-paid"] as any)[key] = (configWithKeys as any)[key]
						logger.info(`ProviderSettingsManager.load: copied ${key} to code-paid`)
					}
				})
			} else {
				logger.info(`ProviderSettingsManager.load: no config with keys found`)
			}

			logger.info(`ProviderSettingsManager.load: mergedApiConfigs keys: ${Object.keys(mergedApiConfigs)}`)

			return {
				...providerProfiles,
				apiConfigs: mergedApiConfigs,
				// Ensure modeApiConfigs includes defaults
				modeApiConfigs: {
					...this.defaultModeApiConfigs,
					...providerProfiles.modeApiConfigs,
				},
			}
		} catch (error) {
			if (error instanceof ZodError) {
				TelemetryService.instance.captureSchemaValidationError({
					schemaName: "ProviderProfiles",
					error,
				})
			}

			throw new Error(`Failed to read provider profiles from secrets: ${error}`)
		}
	}

	private async store(providerProfiles: ProviderProfiles) {
		try {
			await this.context.secrets.store(this.secretsKey, JSON.stringify(providerProfiles, null, 2))
		} catch (error) {
			throw new Error(`Failed to write provider profiles to secrets: ${error}`)
		}
	}

	private findUniqueProfileName(baseName: string, existingNames: Set<string>): string {
		if (!existingNames.has(baseName)) {
			return baseName
		}

		// Try _local first
		const localName = `${baseName}_local`
		if (!existingNames.has(localName)) {
			return localName
		}

		// Try _1, _2, etc.
		let counter = 1
		let candidateName: string
		do {
			candidateName = `${baseName}_${counter}`
			counter++
		} while (existingNames.has(candidateName))

		return candidateName
	}

	public async syncCloudProfiles(
		cloudProfiles: Record<string, ProviderSettingsWithId>,
		currentActiveProfileName?: string,
	): Promise<SyncCloudProfilesResult> {
		try {
			return await this.lock(async () => {
				const providerProfiles = await this.load()
				const changedProfiles: string[] = []
				const existingNames = new Set(Object.keys(providerProfiles.apiConfigs))

				let activeProfileChanged = false
				let activeProfileId = ""

				if (currentActiveProfileName && providerProfiles.apiConfigs[currentActiveProfileName]) {
					activeProfileId = providerProfiles.apiConfigs[currentActiveProfileName].id || ""
				}

				const currentCloudIds = new Set(providerProfiles.cloudProfileIds || [])
				const newCloudIds = new Set(
					Object.values(cloudProfiles)
						.map((p) => p.id)
						.filter((id): id is string => Boolean(id)),
				)

				// Step 1: Delete profiles that are cloud-managed but not in the new cloud profiles
				for (const [name, profile] of Object.entries(providerProfiles.apiConfigs)) {
					if (profile.id && currentCloudIds.has(profile.id) && !newCloudIds.has(profile.id)) {
						// Check if we're deleting the active profile
						if (name === currentActiveProfileName) {
							activeProfileChanged = true
							activeProfileId = "" // Clear the active profile ID since it's being deleted
						}
						delete providerProfiles.apiConfigs[name]
						changedProfiles.push(name)
						existingNames.delete(name)
					}
				}

				// Step 2: Process each cloud profile
				for (const [cloudName, cloudProfile] of Object.entries(cloudProfiles)) {
					if (!cloudProfile.id) {
						continue // Skip profiles without IDs
					}

					// Find existing profile with matching ID
					const existingEntry = Object.entries(providerProfiles.apiConfigs).find(
						([_, profile]) => profile.id === cloudProfile.id,
					)

					if (existingEntry) {
						// Step 3: Update existing profile
						const [existingName, existingProfile] = existingEntry

						// Check if this is the active profile
						const isActiveProfile = existingName === currentActiveProfileName

						// Merge settings, preserving secret keys
						const updatedProfile: ProviderSettingsWithId = { ...cloudProfile }
						for (const [key, value] of Object.entries(existingProfile)) {
							if (isSecretStateKey(key) && value !== undefined) {
								;(updatedProfile as any)[key] = value
							}
						}

						// Check if the profile actually changed using deepEqual
						const profileChanged = !deepEqual(existingProfile, updatedProfile)

						// Handle name change
						if (existingName !== cloudName) {
							// Remove old entry
							delete providerProfiles.apiConfigs[existingName]
							existingNames.delete(existingName)

							// Handle name conflict
							let finalName = cloudName
							if (existingNames.has(cloudName)) {
								// There's a conflict - rename the existing non-cloud profile
								const conflictingProfile = providerProfiles.apiConfigs[cloudName]
								if (conflictingProfile.id !== cloudProfile.id) {
									const newName = this.findUniqueProfileName(cloudName, existingNames)
									providerProfiles.apiConfigs[newName] = conflictingProfile
									existingNames.add(newName)
									changedProfiles.push(newName)
								}
								delete providerProfiles.apiConfigs[cloudName]
								existingNames.delete(cloudName)
							}

							// Add updated profile with new name
							providerProfiles.apiConfigs[finalName] = updatedProfile
							existingNames.add(finalName)
							changedProfiles.push(finalName)
							if (existingName !== finalName) {
								changedProfiles.push(existingName) // Mark old name as changed (deleted)
							}

							// If this was the active profile, mark it as changed
							if (isActiveProfile) {
								activeProfileChanged = true
								activeProfileId = cloudProfile.id || ""
							}
						} else if (profileChanged) {
							// Same name, but profile content changed - update in place
							providerProfiles.apiConfigs[existingName] = updatedProfile
							changedProfiles.push(existingName)

							// If this was the active profile and settings changed, mark it as changed
							if (isActiveProfile) {
								activeProfileChanged = true
								activeProfileId = cloudProfile.id || ""
							}
						}
						// If name is the same and profile hasn't changed, do nothing
					} else {
						// Step 4: Add new cloud profile
						let finalName = cloudName

						// Handle name conflict with existing non-cloud profile
						if (existingNames.has(cloudName)) {
							const existingProfile = providerProfiles.apiConfigs[cloudName]
							if (existingProfile.id !== cloudProfile.id) {
								// Rename the existing profile
								const newName = this.findUniqueProfileName(cloudName, existingNames)
								providerProfiles.apiConfigs[newName] = existingProfile
								existingNames.add(newName)
								changedProfiles.push(newName)

								// Remove the old entry
								delete providerProfiles.apiConfigs[cloudName]
								existingNames.delete(cloudName)
							}
						}

						// Add the new cloud profile (without secret keys)
						const newProfile: ProviderSettingsWithId = { ...cloudProfile }
						// Remove any secret keys from cloud profile
						for (const key of Object.keys(newProfile)) {
							if (isSecretStateKey(key)) {
								delete (newProfile as any)[key]
							}
						}

						providerProfiles.apiConfigs[finalName] = newProfile
						existingNames.add(finalName)
						changedProfiles.push(finalName)
					}
				}

				// Step 5: Handle case where all profiles might be deleted
				if (Object.keys(providerProfiles.apiConfigs).length === 0 && changedProfiles.length > 0) {
					// Create a default profile only if we have changed profiles
					const defaultProfile = { id: this.generateId() }
					providerProfiles.apiConfigs["default"] = defaultProfile
					activeProfileChanged = true
					activeProfileId = defaultProfile.id || ""
					changedProfiles.push("default")
				}

				// Step 6: If active profile was deleted, find a replacement
				if (activeProfileChanged && !activeProfileId) {
					const firstProfile = Object.values(providerProfiles.apiConfigs)[0]
					if (firstProfile?.id) {
						activeProfileId = firstProfile.id
					}
				}

				// Step 7: Update cloudProfileIds
				providerProfiles.cloudProfileIds = Array.from(newCloudIds)

				// Save the updated profiles
				await this.store(providerProfiles)

				return {
					hasChanges: changedProfiles.length > 0,
					activeProfileChanged,
					activeProfileId,
				}
			})
		} catch (error) {
			throw new Error(`Failed to sync cloud profiles: ${error}`)
		}
	}
}
