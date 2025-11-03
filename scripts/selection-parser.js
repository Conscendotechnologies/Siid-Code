#!/usr/bin/env node
// Lightweight selection parser used by the chat flow.
// Accepts user input and matches against a displayed choices array.
// Matching rules (in order):
// 1) Numeric indices (1-based) -> direct mapping
// 2) Exact API name match (case-insensitive)
// 3) Exact label match (case-insensitive)
// 4) Partial match (case-insensitive) if unique

function normalize(s) {
	return String(s || "").trim()
}

function parseInput(input) {
	if (input == null) return []
	// split on commas, semicolons, pipes, or newlines
	return input
		.split(/[;,|\n]+/)
		.map((s) => normalize(s))
		.filter(Boolean)
}

// choices: array of {label, api}
function resolveSelections(rawInput, choices) {
	const items = parseInput(rawInput)
	const results = []
	const errors = []

	items.forEach((it) => {
		// detect explicit default marker like "default:3" or "3 default" will be handled externally
		const token = it.replace(/^default:\s*/i, "").trim()

		// numeric index
		if (/^\d+$/.test(token)) {
			const idx = parseInt(token, 10) - 1
			if (idx >= 0 && idx < choices.length) {
				results.push({ choice: choices[idx], input: it })
				return
			} else {
				errors.push(`Index out of range: ${it}`)
				return
			}
		}

		// exact api
		const byApi = choices.find((c) => c.api && c.api.toLowerCase() === token.toLowerCase())
		if (byApi) {
			results.push({ choice: byApi, input: it })
			return
		}

		// exact label
		const byLabel = choices.find((c) => c.label && c.label.toLowerCase() === token.toLowerCase())
		if (byLabel) {
			results.push({ choice: byLabel, input: it })
			return
		}

		// partial match
		const partials = choices.filter(
			(c) =>
				(c.label && c.label.toLowerCase().includes(token.toLowerCase())) ||
				(c.api && c.api.toLowerCase().includes(token.toLowerCase())),
		)
		if (partials.length === 1) {
			results.push({ choice: partials[0], input: it })
			return
		}
		if (partials.length > 1) {
			errors.push(`Ambiguous selection '${it}' matches multiple choices.`)
			return
		}

		errors.push(`No match for '${it}'`)
	})

	return { results, errors }
}

// Helper to extract default if provided like "1,3 default:3" or "1,3 default=3"
function extractDefault(input) {
	if (!input) return { cleanInput: "", defaultToken: null }
	const m = input.match(/(.+?)\s+(?:default[:=]\s*)(.+)$/i)
	if (m) {
		return { cleanInput: m[1].trim(), defaultToken: m[2].trim() }
	}
	return { cleanInput: input.trim(), defaultToken: null }
}

// CLI test when run directly
if (require.main === module) {
	const sampleChoices = [
		{ label: "Agriculture", api: "Agriculture" },
		{ label: "Finance", api: "Finance" },
		{ label: "Technology", api: "Technology" },
	]

	const argv = process.argv.slice(2).join(" ")
	const { cleanInput, defaultToken } = extractDefault(argv || "1,3 default:3")
	const parsed = resolveSelections(cleanInput, sampleChoices)
	parsed.results.forEach((r) => console.log("-", r.choice.label, `(api:${r.choice.api})`, "from input:", r.input))
	if (parsed.errors.length) console.error("Errors:", parsed.errors.join("; "))
	if (defaultToken) {
		const d = resolveSelections(defaultToken, sampleChoices)
		if (d.errors.length) console.error("Default errors:", d.errors.join("; "))
	}
}

module.exports = { parseInput, resolveSelections, extractDefault }
