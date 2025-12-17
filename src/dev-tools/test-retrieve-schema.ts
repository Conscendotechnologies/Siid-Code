/**
 * Test script for the retrieve_schema tool
 *
 * Usage:
 *   tsx src/dev-tools/test-retrieve-schema.ts [component_name] [schema_file]
 *   tsx src/dev-tools/test-retrieve-schema.ts [schema_file] [component_name]
 *   npm run test:schema:metadata [component_name]
 *   npm run test:schema:apex [component_name]
 *   npm run test:schema:both [component_name]
 *
 * Examples:
 *   tsx src/dev-tools/test-retrieve-schema.ts DeployResult
 *   tsx src/dev-tools/test-retrieve-schema.ts CompileAndTestRequest apex
 *   tsx src/dev-tools/test-retrieve-schema.ts RunTestsRequest both
 *   npm run test:schema:metadata CustomObject
 *   npm run test:schema:apex CompileAndTestRequest
 *   npm run test:schema:both RunTestsRequest
 */

import * as path from "path"
import * as fs from "fs/promises"

interface SchemaFileConfig {
	fileName: string
	filePath: string
	description: string
}

const SCHEMA_FILES: Record<string, SchemaFileConfig> = {
	metadata: {
		fileName: "metadata.xml",
		filePath: ".roo/rules-flow-builder/metadata.xml",
		description: "Salesforce Metadata API v65.0",
	},
	apex: {
		fileName: "apex.xml",
		filePath: ".roo/rules-flow-builder/apex.xml",
		description: "Salesforce Apex API v65.0",
	},
}

function searchComponentInXml(xmlContent: string, componentName: string): string | null {
	const patterns = [
		{
			type: "complexType",
			start: new RegExp(`<xsd:complexType\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/xsd:complexType>/,
			selfClosing: false,
		},
		{
			type: "simpleType",
			start: new RegExp(`<xsd:simpleType\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/xsd:simpleType>/,
			selfClosing: false,
		},
		{
			type: "element",
			start: new RegExp(`<xsd:element\\s+name="${componentName}"[^>]*`, "i"),
			end: /<\/xsd:element>/,
			selfClosing: true,
		},
		{
			type: "message",
			start: new RegExp(`<message\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/message>/,
			selfClosing: false,
		},
		{
			type: "operation",
			start: new RegExp(`<operation\\s+name="${componentName}"[^>]*>`, "i"),
			end: /<\/operation>/,
			selfClosing: false,
		},
	]

	for (const pattern of patterns) {
		const startMatch = xmlContent.match(pattern.start)
		if (startMatch) {
			const startIndex = startMatch.index!
			const contentFromStart = xmlContent.substring(startIndex)

			// Check if it's a self-closing element
			if (pattern.selfClosing) {
				const selfClosingMatch = contentFromStart.match(/^[^>]*\/>/)
				if (selfClosingMatch) {
					const endIndex = startIndex + selfClosingMatch[0].length
					const definition = xmlContent.substring(startIndex, endIndex)
					return definition
				}
			}

			const endMatch = contentFromStart.match(pattern.end)
			if (endMatch) {
				const endIndex = startIndex + endMatch.index! + endMatch[0].length
				const definition = xmlContent.substring(startIndex, endIndex)
				return definition
			}
		}
	}

	return null
}

function findRelatedTypes(definition: string): string[] {
	const relatedTypes: Set<string> = new Set()

	const typeRefs = definition.matchAll(/type="tns:([^"]+)"/g)
	for (const match of typeRefs) {
		relatedTypes.add(match[1])
	}

	const refRefs = definition.matchAll(/ref="tns:([^"]+)"/g)
	for (const match of refRefs) {
		relatedTypes.add(match[1])
	}

	return Array.from(relatedTypes)
}

async function searchInSchemaFile(
	cwd: string,
	componentName: string,
	schemaKey: string,
): Promise<{ found: boolean; definition?: string; relatedTypes?: string[] }> {
	const schemaConfig = SCHEMA_FILES[schemaKey]
	const filePath = path.join(cwd, schemaConfig.filePath)

	try {
		await fs.access(filePath)
		const content = await fs.readFile(filePath, "utf-8")
		const definition = searchComponentInXml(content, componentName)

		if (definition) {
			const relatedTypes = findRelatedTypes(definition)
			return { found: true, definition, relatedTypes }
		}

		return { found: false }
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") {
			throw new Error(
				`Schema file not found: ${schemaConfig.filePath}\n` +
					`Please ensure the schema files are present in the .roo/rules/ directory.`,
			)
		}
		throw error
	}
}

async function main() {
	const args = process.argv.slice(2)

	// Check if first arg is a schema file type (metadata, apex, both)
	// If so, use it as schemaFile and second arg as componentName
	const isFirstArgSchemaFile = ["metadata", "apex", "both"].includes(args[0])

	let componentName: string
	let schemaFile: string

	if (isFirstArgSchemaFile) {
		// npm run test:schema:metadata CustomObject
		schemaFile = args[0]
		componentName = args[1] || "DeployResult"
	} else {
		// tsx src/dev-tools/test-retrieve-schema.ts CustomObject metadata
		componentName = args[0] || "DeployResult"
		schemaFile = args[1] || "metadata"
	}

	console.log(`\nSearching for component: ${componentName}`)
	console.log(`Schema file: ${schemaFile}\n`)

	const cwd = process.cwd()

	try {
		let result: { found: boolean; definition?: string; relatedTypes?: string[]; schemaKey?: string } = {
			found: false,
		}

		if (schemaFile === "both") {
			for (const key of ["metadata", "apex"]) {
				try {
					const searchResult = await searchInSchemaFile(cwd, componentName, key)
					if (searchResult.found) {
						result = { ...searchResult, schemaKey: key }
						break
					}
				} catch (error) {
					if ((error as Error).message.includes("not found")) {
						continue
					}
					throw error
				}
			}
		} else {
			const searchResult = await searchInSchemaFile(cwd, componentName, schemaFile)
			result = { ...searchResult, schemaKey: schemaFile }
		}

		if (result.found && result.definition && result.schemaKey) {
			console.log(`✅ Found in ${SCHEMA_FILES[result.schemaKey].description}\n`)
			console.log("Schema Definition:")
			console.log("=".repeat(80))
			console.log(result.definition)
			console.log("=".repeat(80))

			if (result.relatedTypes && result.relatedTypes.length > 0) {
				console.log(`\n📎 Referenced types: ${result.relatedTypes.join(", ")}`)
			}
		} else {
			const searchedFiles =
				schemaFile === "both"
					? "both metadata.xml and apex.xml"
					: `${SCHEMA_FILES[schemaFile].fileName} (${SCHEMA_FILES[schemaFile].description})`

			console.log(`❌ Component '${componentName}' not found in ${searchedFiles}`)
		}
	} catch (error) {
		console.error(`\n❌ Error: ${(error as Error).message}`)
		process.exit(1)
	}
}

main()
