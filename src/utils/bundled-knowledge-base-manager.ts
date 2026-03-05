import * as path from "path"
import * as fs from "fs/promises"
import * as vscode from "vscode"

import { directoryExists, fileExists } from "../services/roo-config"

/**
 * Manages bundled error knowledge base files from the VSIX package
 * Handles copying bundled KB files to global storage on activation
 */
export class BundledKnowledgeBaseManager {
	private readonly globalStoragePath: string
	private readonly bundledPath: string
	private readonly context: vscode.ExtensionContext

	constructor(context: vscode.ExtensionContext) {
		this.context = context
		// Path to error knowledge base in global storage
		this.globalStoragePath = path.join(context.globalStorageUri.fsPath, "error-knowledge-base")
		// Path to bundled KB in the extension directory (no .roo folder)
		this.bundledPath = path.join(context.extensionPath, "dist", "bundled", "error-knowledge-base")
	}

	/**
	 * Initialize bundled knowledge base - copy from extension to global storage
	 */
	async initializeBundledKnowledgeBase(): Promise<void> {
		try {
			console.log(`[BundledKnowledgeBaseManager] Initializing KB from: ${this.bundledPath}`)

			// Check if bundled KB exists in extension
			if (!(await directoryExists(this.bundledPath))) {
				console.warn(`[BundledKnowledgeBaseManager] ⚠️ Bundled KB not found at: ${this.bundledPath}`)
				return
			}

			console.log(`[BundledKnowledgeBaseManager] ✅ Found bundled KB at: ${this.bundledPath}`)

			// Create the global storage directory
			await fs.mkdir(this.globalStoragePath, { recursive: true })

			// Copy all KB files from bundled to global storage
			await this.copyKnowledgeBaseFiles()

			console.log(
				`[BundledKnowledgeBaseManager] ✅ Successfully initialized KB in global storage: ${this.globalStoragePath}`,
			)
		} catch (error) {
			console.error("[BundledKnowledgeBaseManager] ❌ Failed to initialize bundled KB:", error)
			// Don't throw - extension should continue to work even if KB initialization fails
		}
	}

	/**
	 * Copy all KB files from bundled path to global storage
	 */
	private async copyKnowledgeBaseFiles(): Promise<void> {
		try {
			const files = await fs.readdir(this.bundledPath)

			// Filter for YAML files (error definitions)
			const yamlFiles = files.filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))

			if (yamlFiles.length === 0) {
				console.warn(`[BundledKnowledgeBaseManager] ⚠️ No YAML files found in bundled KB`)
				return
			}

			console.log(`[BundledKnowledgeBaseManager] Copying ${yamlFiles.length} KB file(s)...`)

			for (const file of yamlFiles) {
				const sourcePath = path.join(this.bundledPath, file)
				const destPath = path.join(this.globalStoragePath, file)

				try {
					await fs.copyFile(sourcePath, destPath)
					console.log(`[BundledKnowledgeBaseManager] ✅ Copied: ${file}`)
				} catch (error) {
					console.error(`[BundledKnowledgeBaseManager] ❌ Failed to copy ${file}:`, error)
				}
			}
		} catch (error) {
			console.error("[BundledKnowledgeBaseManager] ❌ Error copying knowledge base files:", error)
			throw error
		}
	}

	/**
	 * Get the global storage path where KB files are stored
	 */
	getGlobalStoragePath(): string {
		return this.globalStoragePath
	}

	/**
	 * Get the bundled path where KB files are sourced from
	 */
	getBundledPath(): string {
		return this.bundledPath
	}
}
