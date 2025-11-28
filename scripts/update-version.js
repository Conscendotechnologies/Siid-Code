#!/usr/bin/env node

const fs = require("fs")
const path = require("path")

const srcPackageJsonPath = path.join(__dirname, "..", "src", "package.json")

function incrementVersion(version, type) {
	const parts = version.split(".").map(Number)
	if (parts.length !== 3) {
		throw new Error("Invalid version format. Expected x.y.z")
	}
	switch (type) {
		case "patch":
			parts[2]++
			break
		case "minor":
			parts[1]++
			parts[2] = 0
			break
		case "major":
			parts[0]++
			parts[1] = 0
			parts[2] = 0
			break
		default:
			throw new Error("Invalid increment type. Use patch, minor, or major")
	}
	return parts.join(".")
}

function updateVersion(newVersion) {
	try {
		// Update src/package.json
		const srcPackageJson = JSON.parse(fs.readFileSync(srcPackageJsonPath, "utf8"))
		srcPackageJson.version = newVersion
		fs.writeFileSync(srcPackageJsonPath, JSON.stringify(srcPackageJson, null, 2) + "\n")
	} catch (error) {
		process.exit(1)
	}
}

const arg = process.argv[2]
if (!arg) {
	process.exit(1)
}

let newVersion
if (["patch", "minor", "major"].includes(arg)) {
	const packageJson = JSON.parse(fs.readFileSync(srcPackageJsonPath, "utf8"))
	newVersion = incrementVersion(packageJson.version, arg)
} else {
	newVersion = arg
}

updateVersion(newVersion)
