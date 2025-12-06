#!/usr/bin/env ts-node

/**
 * Development Tool: Test fetch_instructions functionality
 *
 * Usage:
 *   npm run test:instructions
 *   npm run test:instructions -- apex
 *   npm run test:instructions -- apex "SOQL & SOSL"
 *   npm run test:instructions -- lwc toc
 */

import * as path from "path"
import * as fs from "fs/promises"
import {
	extractTableOfContents,
	findSection,
	getGuideSummary,
	parseMarkdownSections,
} from "../core/prompts/instructions/markdown-parser"

const COLORS = {
	reset: "\x1b[0m",
	bright: "\x1b[1m",
	dim: "\x1b[2m",
	red: "\x1b[31m",
	green: "\x1b[32m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	magenta: "\x1b[35m",
	cyan: "\x1b[36m",
}

function log(color: keyof typeof COLORS, ...args: any[]) {
	console.log(COLORS[color], ...args, COLORS.reset)
}

function header(text: string) {
	console.log("\n" + COLORS.bright + COLORS.cyan + "═".repeat(80) + COLORS.reset)
	console.log(COLORS.bright + COLORS.cyan + text + COLORS.reset)
	console.log(COLORS.bright + COLORS.cyan + "═".repeat(80) + COLORS.reset + "\n")
}

function section(text: string) {
	console.log("\n" + COLORS.bright + COLORS.blue + "─".repeat(80) + COLORS.reset)
	console.log(COLORS.bright + COLORS.blue + text + COLORS.reset)
	console.log(COLORS.bright + COLORS.blue + "─".repeat(80) + COLORS.reset)
}

async function loadGuide(type: "apex" | "lwc"): Promise<{ content: string; path: string }> {
	const guidePath =
		type === "apex"
			? path.join(__dirname, "../../.roo/rules-code/apex-guide.md")
			: path.join(__dirname, "../../.roo/rules-code/lwc-guide.md")

	try {
		const content = await fs.readFile(guidePath, "utf-8")
		return { content, path: guidePath }
	} catch (error) {
		log("red", `Error loading guide from ${guidePath}:`, error)
		throw error
	}
}

function displayStats(content: string) {
	const lines = content.split("\n")
	const chars = content.length
	const words = content.split(/\s+/).length
	const estimatedTokens = Math.ceil(chars / 4) // Rough estimate: 1 token ≈ 4 characters

	console.log(COLORS.dim + "Statistics:" + COLORS.reset)
	console.log(`  Lines: ${lines.length}`)
	console.log(`  Characters: ${chars.toLocaleString()}`)
	console.log(`  Words: ${words.toLocaleString()}`)
	console.log(`  Estimated Tokens: ~${estimatedTokens.toLocaleString()}`)
}

async function testTableOfContents(content: string) {
	section("📋 Table of Contents")

	const toc = extractTableOfContents(content)
	console.log(COLORS.green + `Found ${toc.sections.length} sections` + COLORS.reset)
	console.log("\n" + toc.summary)

	displayStats(toc.summary)
}

async function testSectionParsing(content: string) {
	section("🔍 Section Parsing")

	const sections = parseMarkdownSections(content)
	console.log(COLORS.green + `Parsed ${sections.length} total sections` + COLORS.reset + "\n")

	// Show first 5 sections as preview
	sections.slice(0, 5).forEach((sec, idx) => {
		console.log(`${idx + 1}. ${COLORS.bright}${sec.title}${COLORS.reset}`)
		console.log(`   Level: ${sec.level}, Lines: ${sec.startLine}-${sec.endLine}`)
		console.log(`   Preview: ${sec.content.substring(0, 100).replace(/\n/g, " ")}...`)
		console.log()
	})

	if (sections.length > 5) {
		console.log(COLORS.dim + `... and ${sections.length - 5} more sections` + COLORS.reset)
	}
}

async function testSectionRetrieval(content: string, query: string) {
	section(`🎯 Section Retrieval: "${query}"`)

	const result = findSection(content, query)

	if (result) {
		log("green", `✓ Found section: "${result.title}"`)
		console.log("\n" + COLORS.bright + "Content:" + COLORS.reset)
		console.log(result.content.substring(0, 500))

		if (result.content.length > 500) {
			console.log(COLORS.dim + `\n... (${result.content.length - 500} more characters)` + COLORS.reset)
		}

		console.log()
		displayStats(result.content)
	} else {
		log("red", `✗ Section "${query}" not found`)

		// Show suggestions
		const toc = extractTableOfContents(content)
		console.log("\n" + COLORS.yellow + "Available sections:" + COLORS.reset)
		toc.sections.slice(0, 10).forEach((sec) => {
			console.log(`  ${sec.number}. ${sec.title}`)
		})
		if (toc.sections.length > 10) {
			console.log(COLORS.dim + `  ... and ${toc.sections.length - 10} more` + COLORS.reset)
		}
	}
}

async function testGuideSummary(content: string, guideName: string) {
	section(`📝 Guide Summary: ${guideName}`)

	const summary = getGuideSummary(content, guideName)
	console.log(summary)
	console.log()
	displayStats(summary)

	// Calculate token savings
	const fullTokens = Math.ceil(content.length / 4)
	const summaryTokens = Math.ceil(summary.length / 4)
	const savings = (((fullTokens - summaryTokens) / fullTokens) * 100).toFixed(1)

	console.log("\n" + COLORS.green + "💰 Token Savings:" + COLORS.reset)
	console.log(`  Full guide: ~${fullTokens.toLocaleString()} tokens`)
	console.log(`  Summary: ~${summaryTokens.toLocaleString()} tokens`)
	console.log(`  Savings: ${COLORS.bright}${savings}%${COLORS.reset}`)
}

async function interactiveMode(type: "apex" | "lwc", content: string) {
	header(`🎮 Interactive Mode: ${type.toUpperCase()} Guide`)

	const readline = require("readline")
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	const prompt = () => {
		rl.question(
			COLORS.cyan + '\nEnter section (number/title/toc) or "quit": ' + COLORS.reset,
			async (answer: string) => {
				const trimmed = answer.trim()

				if (trimmed === "quit" || trimmed === "q" || trimmed === "exit") {
					log("yellow", "\n👋 Goodbye!")
					rl.close()
					return
				}

				if (!trimmed) {
					await testGuideSummary(content, type.toUpperCase())
				} else {
					await testSectionRetrieval(content, trimmed)
				}

				prompt()
			},
		)
	}

	console.log(COLORS.dim + "Commands:" + COLORS.reset)
	console.log('  - Enter a section number (e.g., "5")')
	console.log('  - Enter a section title (e.g., "SOQL & SOSL")')
	console.log('  - Enter "toc" for table of contents')
	console.log("  - Press Enter for guide summary")
	console.log('  - Type "quit" to exit')

	prompt()
}

async function runTests(type: "apex" | "lwc", sectionQuery?: string) {
	try {
		header(`🧪 Testing fetch_instructions: ${type.toUpperCase()} Guide`)

		log("blue", `Loading guide...`)
		const { content, path: guidePath } = await loadGuide(type)
		log("green", `✓ Loaded from: ${guidePath}`)

		console.log()
		displayStats(content)

		if (sectionQuery) {
			// Test specific section
			await testSectionRetrieval(content, sectionQuery)
		} else {
			// Run all tests
			await testGuideSummary(content, type.toUpperCase())
			await testTableOfContents(content)
			await testSectionParsing(content)

			// Interactive mode
			console.log("\n" + COLORS.yellow + "Entering interactive mode..." + COLORS.reset)
			await interactiveMode(type, content)
		}
	} catch (error) {
		log("red", "\n❌ Error:", error)
		process.exit(1)
	}
}

// Parse command line arguments
const args = process.argv.slice(2)
const guideType = (args[0] || "apex").toLowerCase() as "apex" | "lwc"
const sectionQuery = args[1]

if (!["apex", "lwc"].includes(guideType)) {
	console.error(COLORS.red + 'Error: Guide type must be "apex" or "lwc"' + COLORS.reset)
	console.log("\nUsage:")
	console.log("  npm run test:instructions              # Test Apex guide (interactive)")
	console.log("  npm run test:instructions apex         # Test Apex guide (interactive)")
	console.log("  npm run test:instructions lwc          # Test LWC guide (interactive)")
	console.log('  npm run test:instructions apex "5"     # Test Apex section 5')
	console.log('  npm run test:instructions lwc "toc"    # Test LWC table of contents')
	process.exit(1)
}

// Run tests
runTests(guideType, sectionQuery).catch((error) => {
	log("red", "Fatal error:", error)
	process.exit(1)
})
