/**
 * Utility functions for parsing and extracting sections from markdown files
 */

export interface MarkdownSection {
	title: string
	level: number
	content: string
	startLine: number
	endLine: number
}

export interface TableOfContents {
	sections: Array<{
		number: number
		title: string
		level: number
	}>
	summary: string
}

/**
 * Extracts table of contents from markdown content
 */
export function extractTableOfContents(content: string): TableOfContents {
	const lines = content.split("\n")
	const sections: Array<{ number: number; title: string; level: number }> = []
	let sectionNumber = 0

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)

		if (headerMatch) {
			const level = headerMatch[1].length
			const title = headerMatch[2].trim()

			// Only include level 2 and 3 headers in TOC (## and ###)
			if (level === 2 || level === 3) {
				sectionNumber++
				sections.push({
					number: sectionNumber,
					title,
					level,
				})
			}
		}
	}

	// Generate summary text
	let summary = "# Table of Contents\n\n"
	summary += "Use `fetch_instructions` with the `section` parameter to retrieve specific sections.\n\n"
	summary += "**Usage Examples:**\n"
	summary += '- `fetch_instructions(task="create_apex", section="SOQL & SOSL")` - Get specific section by title\n'
	summary += '- `fetch_instructions(task="create_apex", section="5")` - Get section by number\n'
	summary += '- `fetch_instructions(task="create_apex", section="toc")` - Get this table of contents\n\n'
	summary += "## Available Sections:\n\n"

	sections.forEach((section) => {
		const indent = "  ".repeat(section.level - 2)
		summary += `${indent}${section.number}. ${section.title}\n`
	})

	return { sections, summary }
}

/**
 * Parses markdown content into sections
 */
export function parseMarkdownSections(content: string): MarkdownSection[] {
	const lines = content.split("\n")
	const sections: MarkdownSection[] = []
	let currentSection: MarkdownSection | null = null

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const headerMatch = line.match(/^(#{1,6})\s+(.+)$/)

		if (headerMatch) {
			// Save previous section if exists
			if (currentSection) {
				currentSection.endLine = i - 1
				currentSection.content = lines.slice(currentSection.startLine, currentSection.endLine + 1).join("\n")
				sections.push(currentSection)
			}

			// Start new section
			const level = headerMatch[1].length
			const title = headerMatch[2].trim()
			currentSection = {
				title,
				level,
				content: "",
				startLine: i,
				endLine: i,
			}
		}
	}

	// Save last section
	if (currentSection) {
		currentSection.endLine = lines.length - 1
		currentSection.content = lines.slice(currentSection.startLine, currentSection.endLine + 1).join("\n")
		sections.push(currentSection)
	}

	return sections
}

/**
 * Extracts a section with all its subsections (content until next same-level header)
 */
function extractSectionWithSubsections(content: string, sectionTitle: string, sectionLevel: number): string | null {
	const lines = content.split("\n")
	let startLine = -1
	let endLine = lines.length - 1

	// Find the start of the section
	for (let i = 0; i < lines.length; i++) {
		const headerMatch = lines[i].match(/^(#{1,6})\s+(.+)$/)
		if (headerMatch) {
			const level = headerMatch[1].length
			const title = headerMatch[2].trim()

			if (level === sectionLevel && title === sectionTitle) {
				startLine = i
				break
			}
		}
	}

	if (startLine === -1) return null

	// Find the end of the section (next header of same or lower level)
	for (let i = startLine + 1; i < lines.length; i++) {
		const headerMatch = lines[i].match(/^(#{1,6})\s+(.+)$/)
		if (headerMatch) {
			const level = headerMatch[1].length
			// Stop at next header of same or lower level (e.g., if section is ##, stop at next ##)
			if (level <= sectionLevel) {
				endLine = i - 1
				break
			}
		}
	}

	return lines.slice(startLine, endLine + 1).join("\n")
}

/**
 * Finds a section by title or number
 */
export function findSection(content: string, query: string): { content: string; title: string } | null {
	const sections = parseMarkdownSections(content)
	const toc = extractTableOfContents(content)

	// Special case: return TOC
	if (query.toLowerCase() === "toc" || query.toLowerCase() === "table of contents") {
		return {
			content: toc.summary,
			title: "Table of Contents",
		}
	}

	// Try to find by number
	const sectionNumber = parseInt(query, 10)
	if (!isNaN(sectionNumber) && sectionNumber > 0 && sectionNumber <= toc.sections.length) {
		const tocEntry = toc.sections[sectionNumber - 1]
		const sectionContent = extractSectionWithSubsections(content, tocEntry.title, tocEntry.level)
		if (sectionContent) {
			return {
				content: sectionContent,
				title: tocEntry.title,
			}
		}
	}

	// Try to find by exact title match (case-insensitive)
	const normalizedQuery = query.toLowerCase().trim()
	const exactMatch = sections.find((s) => s.title.toLowerCase() === normalizedQuery)
	if (exactMatch) {
		const sectionContent = extractSectionWithSubsections(content, exactMatch.title, exactMatch.level)
		if (sectionContent) {
			return {
				content: sectionContent,
				title: exactMatch.title,
			}
		}
	}

	// Try to find by partial title match
	const partialMatch = sections.find((s) => s.title.toLowerCase().includes(normalizedQuery))
	if (partialMatch) {
		const sectionContent = extractSectionWithSubsections(content, partialMatch.title, partialMatch.level)
		if (sectionContent) {
			return {
				content: sectionContent,
				title: partialMatch.title,
			}
		}
	}

	// Section not found
	return null
}

/**
 * Gets a summary of the guide with TOC
 */
export function getGuideSummary(content: string, guideName: string): string {
	const toc = extractTableOfContents(content)

	// Extract the first few lines (title and description)
	const lines = content.split("\n")
	let header = ""
	let lineCount = 0

	for (const line of lines) {
		if (lineCount > 20) break // Get first ~20 lines
		if (line.trim()) {
			header += line + "\n"
			lineCount++
		}
		// Stop at first level 2 header
		if (line.match(/^##\s+/)) {
			break
		}
	}

	return `# ${guideName} Guide Summary\n\n${header}\n\n---\n\n${toc.summary}`
}
