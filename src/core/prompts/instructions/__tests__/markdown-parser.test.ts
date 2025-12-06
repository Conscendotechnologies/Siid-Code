import { describe, it, expect } from "vitest"
import { extractTableOfContents, parseMarkdownSections, findSection, getGuideSummary } from "../markdown-parser"

const SAMPLE_MARKDOWN = `# Main Title

Some introduction text.

## Section One

Content for section one.
More content here.

### Subsection 1.1

Nested content.

## Section Two

Content for section two.

### Subsection 2.1

More nested content.

### Subsection 2.2

Even more content.

## Section Three

Final section content.
`

describe("markdown-parser", () => {
	describe("extractTableOfContents", () => {
		it("should extract table of contents from markdown", () => {
			const toc = extractTableOfContents(SAMPLE_MARKDOWN)

			expect(toc.sections).toHaveLength(6)
			expect(toc.sections[0]).toEqual({
				number: 1,
				title: "Section One",
				level: 2,
			})
			expect(toc.sections[1]).toEqual({
				number: 2,
				title: "Subsection 1.1",
				level: 3,
			})
		})

		it("should generate formatted summary", () => {
			const toc = extractTableOfContents(SAMPLE_MARKDOWN)

			expect(toc.summary).toContain("# Table of Contents")
			expect(toc.summary).toContain("1. Section One")
			expect(toc.summary).toContain("  2. Subsection 1.1")
			expect(toc.summary).toContain("fetch_instructions")
		})

		it("should only include level 2 and 3 headers", () => {
			const markdown = `# Title
## Level 2
### Level 3
#### Level 4
##### Level 5`

			const toc = extractTableOfContents(markdown)
			expect(toc.sections).toHaveLength(2)
			expect(toc.sections[0].level).toBe(2)
			expect(toc.sections[1].level).toBe(3)
		})
	})

	describe("parseMarkdownSections", () => {
		it("should parse markdown into sections", () => {
			const sections = parseMarkdownSections(SAMPLE_MARKDOWN)

			expect(sections.length).toBeGreaterThan(0)
			expect(sections[0].title).toBe("Main Title")
			expect(sections[0].level).toBe(1)
			expect(sections[0].content).toContain("Some introduction text")
		})

		it("should capture correct line ranges", () => {
			const sections = parseMarkdownSections(SAMPLE_MARKDOWN)

			sections.forEach((section) => {
				expect(section.startLine).toBeLessThanOrEqual(section.endLine)
				expect(section.content).toBeTruthy()
			})
		})

		it("should handle sections with subsections", () => {
			const sections = parseMarkdownSections(SAMPLE_MARKDOWN)
			const sectionOne = sections.find((s) => s.title === "Section One")

			expect(sectionOne).toBeDefined()
			expect(sectionOne!.content).toContain("Content for section one")
		})
	})

	describe("findSection", () => {
		it("should find section by exact title (case-insensitive)", () => {
			const result = findSection(SAMPLE_MARKDOWN, "section one")

			expect(result).toBeDefined()
			expect(result!.title).toBe("Section One")
			expect(result!.content).toContain("Content for section one")
		})

		it("should find section by partial title", () => {
			const result = findSection(SAMPLE_MARKDOWN, "subsection 1")

			expect(result).toBeDefined()
			expect(result!.title).toBe("Subsection 1.1")
		})

		it("should find section by number", () => {
			const result = findSection(SAMPLE_MARKDOWN, "3")

			expect(result).toBeDefined()
			expect(result!.title).toBe("Section Two")
		})

		it('should return TOC for "toc" query', () => {
			const result = findSection(SAMPLE_MARKDOWN, "toc")

			expect(result).toBeDefined()
			expect(result!.title).toBe("Table of Contents")
			expect(result!.content).toContain("# Table of Contents")
		})

		it("should return null for non-existent section", () => {
			const result = findSection(SAMPLE_MARKDOWN, "nonexistent section")

			expect(result).toBeNull()
		})

		it('should handle "table of contents" query', () => {
			const result = findSection(SAMPLE_MARKDOWN, "table of contents")

			expect(result).toBeDefined()
			expect(result!.title).toBe("Table of Contents")
		})
	})

	describe("getGuideSummary", () => {
		it("should generate summary with TOC", () => {
			const summary = getGuideSummary(SAMPLE_MARKDOWN, "Test Guide")

			expect(summary).toContain("# Test Guide Guide Summary")
			expect(summary).toContain("# Table of Contents")
			expect(summary).toContain("Main Title")
		})

		it("should include first ~20 lines", () => {
			const summary = getGuideSummary(SAMPLE_MARKDOWN, "Test")

			expect(summary).toContain("Some introduction text")
		})

		it("should stop at first level 2 header", () => {
			const markdown = `# Title
Introduction line 1
Introduction line 2

## First Section
Content here`

			const summary = getGuideSummary(markdown, "Test")

			expect(summary).toContain("Introduction line 1")
			expect(summary).toContain("## First Section")
		})
	})

	describe("edge cases", () => {
		it("should handle empty markdown", () => {
			const toc = extractTableOfContents("")
			expect(toc.sections).toHaveLength(0)

			const sections = parseMarkdownSections("")
			expect(sections).toHaveLength(0)
		})

		it("should handle markdown without headers", () => {
			const markdown = "Just plain text\nNo headers here"
			const toc = extractTableOfContents(markdown)
			expect(toc.sections).toHaveLength(0)
		})

		it("should handle malformed headers", () => {
			const markdown = `#No space after hash
## Proper Header
###Also no space`

			const sections = parseMarkdownSections(markdown)
			expect(sections.length).toBe(1)
			expect(sections[0].title).toBe("Proper Header")
		})
	})

	describe("real-world scenarios", () => {
		const complexMarkdown = `# Apex Reference Guide

## Executive Summary

Apex is Salesforce's language.

## Language Fundamentals

### Syntax Overview

Code examples here.

### Key Differences

More content.

## Data Types

### Primitive Types

Types list.

## Collections

### List

Lists info.

### Set

Sets info.

### Map

Maps info.`

		it("should handle complex nested structure", () => {
			const toc = extractTableOfContents(complexMarkdown)
			expect(toc.sections.length).toBeGreaterThan(5)
		})

		it("should find deeply nested sections", () => {
			const result = findSection(complexMarkdown, "primitive types")
			expect(result).toBeDefined()
			expect(result!.title).toBe("Primitive Types")
		})

		it("should calculate correct section numbers", () => {
			const toc = extractTableOfContents(complexMarkdown)
			const sectionNumbers = toc.sections.map((s) => s.number)

			// Should be sequential
			expect(sectionNumbers).toEqual(Array.from({ length: sectionNumbers.length }, (_, i) => i + 1))
		})
	})
})
