# Testing fetch_instructions Tool

This document explains how to test the `fetch_instructions` functionality during development.

## Overview

We've created several tools to help test the section-based instruction retrieval:

1. **CLI Testing Tool** - Interactive command-line interface
2. **Unit Tests** - Automated tests for markdown parsing
3. **Manual Testing** - Direct tool invocation examples

## CLI Testing Tool

### Quick Start

```bash
# Test Apex guide (interactive mode)
npm run test:instructions

# Test LWC guide (interactive mode)
npm run test:instructions:lwc

# Test specific section by title
npm run test:instructions apex "SOQL & SOSL"

# Test section by number
npm run test:instructions lwc "5"

# Get table of contents
npm run test:instructions apex toc
```

### Interactive Mode

When you run the tool without a section parameter, it enters interactive mode:

```bash
npm run test:instructions
```

**Interactive Commands:**

- Enter a section number (e.g., `5`)
- Enter a section title (e.g., `SOQL & SOSL`)
- Enter `toc` for table of contents
- Press Enter (empty) for guide summary
- Type `quit` to exit

### What It Shows

The CLI tool displays:

1. **Statistics**

    - Line count
    - Character count
    - Word count
    - Estimated token count

2. **Table of Contents**

    - All available sections
    - Section numbers and titles
    - Nested structure

3. **Section Content**
    - Full section text
    - Preview (first 500 chars)
    - Token savings calculation

### Example Output

```
════════════════════════════════════════════════════════════════════════════════
🧪 Testing fetch_instructions: APEX Guide
════════════════════════════════════════════════════════════════════════════════

Loading guide...
✓ Loaded from: .roo/rules-code/apex-guide.md

Statistics:
  Lines: 2515
  Characters: 89,234
  Words: 12,456
  Estimated Tokens: ~22,308

────────────────────────────────────────────────────────────────────────────────
📝 Guide Summary: APEX
────────────────────────────────────────────────────────────────────────────────

# Apex Guide Summary

# Apex Reference Guide
...

# Table of Contents

Use `fetch_instructions` with the `section` parameter to retrieve specific sections.

## Available Sections:

1. Language Fundamentals
2. Data Types
3. Collections
...

💰 Token Savings:
  Full guide: ~22,308 tokens
  Summary: ~3,000 tokens
  Savings: 86.5%
```

## Unit Tests

### Running Tests

```bash
# Run all tests
npm test

# Run markdown parser tests specifically
npm test -- markdown-parser

# Watch mode
npm test -- --watch
```

### Test Coverage

The unit tests cover:

- `extractTableOfContents()` - TOC generation
- `parseMarkdownSections()` - Section parsing
- `findSection()` - Section retrieval
- `getGuideSummary()` - Summary generation
- Edge cases (empty files, malformed headers, etc.)

### Adding New Tests

Tests are located in:

```
src/core/prompts/instructions/__tests__/markdown-parser.test.ts
```

Example test:

```typescript
it("should find section by title", () => {
	const result = findSection(content, "SOQL & SOSL")
	expect(result).toBeDefined()
	expect(result!.title).toBe("SOQL & SOSL")
})
```

## Manual Testing in VSCode Extension

### Setup

1. Build the extension:

    ```bash
    npm run build
    ```

2. Press `F5` in VSCode to launch Extension Development Host

3. Open the Pro-Code extension panel

### Test Scenarios

#### Scenario 1: Get Summary with TOC

```xml
<fetch_instructions>
  <task>create_apex</task>
</fetch_instructions>
```

**Expected:**

- Returns guide summary (~200 lines)
- Includes table of contents
- ~90% token savings

#### Scenario 2: Get Specific Section by Title

```xml
<fetch_instructions>
  <task>create_apex</task>
  <section>SOQL & SOSL</section>
</fetch_instructions>
```

**Expected:**

- Returns only SOQL section
- Includes section header
- ~95% token savings vs full guide

#### Scenario 3: Get Section by Number

```xml
<fetch_instructions>
  <task>create_lwc</task>
  <section>5</section>
</fetch_instructions>
```

**Expected:**

- Returns section #5 content
- Maps to specific section in TOC

#### Scenario 4: Get TOC Only

```xml
<fetch_instructions>
  <task>create_apex</task>
  <section>toc</section>
</fetch_instructions>
```

**Expected:**

- Returns only table of contents
- ~98% token savings

#### Scenario 5: Invalid Section

```xml
<fetch_instructions>
  <task>create_apex</task>
  <section>NonExistentSection</section>
</fetch_instructions>
```

**Expected:**

- Returns error message
- Shows available sections (TOC)
- Helps user find correct section

## Debugging

### Enable Debug Logging

Add console.log statements in the markdown parser:

```typescript
// src/core/prompts/instructions/markdown-parser.ts
export function findSection(content: string, query: string) {
	console.log("[DEBUG] Finding section:", query)
	const sections = parseMarkdownSections(content)
	console.log("[DEBUG] Total sections:", sections.length)
	// ...
}
```

### Check File Paths

Ensure guide files exist:

```bash
ls -la .roo/rules-code/
# Should show apex-guide.md and lwc-guide.md
```

### Verify Build

```bash
npm run build
# Check for errors in markdown-parser compilation
```

## Performance Testing

### Measure Token Savings

The CLI tool automatically calculates token savings:

```bash
npm run test:instructions apex
# Look for "💰 Token Savings" section
```

### Benchmark Different Queries

```typescript
// Time different query types
console.time("Full guide")
const full = await fetchInstructions("create_apex", {})
console.timeEnd("Full guide")

console.time("Section query")
const section = await fetchInstructions("create_apex", { section: "SOQL" })
console.timeEnd("Section query")
```

## Common Issues

### Issue: "Guide file not found"

**Solution:** Check that guides are in `.roo/rules-code/`:

```bash
# Copy guides if missing
cp path/to/apex-guide.md .roo/rules-code/
cp path/to/lwc-guide.md .roo/rules-code/
```

### Issue: "Section not found"

**Solution:** Use the CLI tool to see available sections:

```bash
npm run test:instructions apex toc
```

### Issue: "ts-node not found"

**Solution:** Install ts-node:

```bash
npm install -D ts-node
```

### Issue: "Cannot find module 'markdown-parser'"

**Solution:** Rebuild the project:

```bash
npm run build
```

## Best Practices

1. **Test Before Committing**

    ```bash
    npm run test
    npm run test:instructions apex
    npm run test:instructions lwc
    ```

2. **Verify Token Savings**

    - Always check that summaries save 80%+ tokens
    - Ensure sections are properly extracted

3. **Test Edge Cases**

    - Empty section names
    - Special characters in titles
    - Very long section names
    - Non-existent section numbers

4. **Interactive Testing**
    - Use interactive mode for exploration
    - Test fuzzy matching (partial titles)
    - Verify TOC accuracy

## Example Workflow

```bash
# 1. Make changes to markdown-parser.ts
vim src/core/prompts/instructions/markdown-parser.ts

# 2. Run unit tests
npm test -- markdown-parser

# 3. Test with CLI tool
npm run test:instructions apex

# 4. Try interactive mode
npm run test:instructions
# Type: "SOQL"
# Type: "5"
# Type: "toc"
# Type: quit

# 5. Build and test in extension
npm run build
# Press F5 in VSCode
# Test in extension development host

# 6. Verify token savings
npm run test:instructions apex | grep "Savings"
```

## Continuous Improvement

### Adding More Test Cases

Add to `markdown-parser.test.ts`:

```typescript
it("should handle your new scenario", () => {
	const result = findSection(content, "Your Query")
	expect(result).toBeDefined()
	// Add assertions
})
```

### Extending CLI Tool

Edit `test-fetch-instructions.ts` to add:

- New query types
- Additional statistics
- Export functionality
- Comparison mode

### Performance Monitoring

Track token usage over time:

```bash
npm run test:instructions apex | tee logs/token-usage-$(date +%Y%m%d).log
```

## Resources

- [Markdown Parser Source](../src/core/prompts/instructions/markdown-parser.ts)
- [CLI Tool Source](../src/dev-tools/test-fetch-instructions.ts)
- [Unit Tests](../src/core/prompts/instructions/__tests__/markdown-parser.test.ts)
- [Apex Guide](.roo/rules-code/apex-guide.md)
- [LWC Guide](.roo/rules-code/lwc-guide.md)
