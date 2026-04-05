export interface SfMetadataParams {
	metadata_type?: string
	metadata_name?: string
}

function getLeadingPlainText(value: string | undefined): string | undefined {
	if (!value) {
		return undefined
	}

	const trimmedStart = value.trimStart()
	const match = trimmedStart.match(/^[^<\r\n]+/)
	const normalized = match?.[0]?.trim()

	return normalized && normalized.length > 0 ? normalized : undefined
}

function extractLeakedMetadataName(value: string | undefined): string | undefined {
	if (!value) {
		return undefined
	}

	const patterns = [
		/<metadata_name>\s*([^<\r\n]+?)\s*<\/metadata_name>/i,
		/<metadata_name>\s*([^<\r\n]+?)$/i,
		/<\/metadata_name>\s*([^<\r\n]+?)\s*<\/metadata_name>/i,
	] as const

	for (const pattern of patterns) {
		const normalized = value.match(pattern)?.[1]?.trim()
		if (normalized) {
			return normalized
		}
	}

	return undefined
}

export function normalizeSfMetadataParams(params: SfMetadataParams): Required<SfMetadataParams> {
	const metadataType = getLeadingPlainText(params.metadata_type) ?? ""
	const metadataName =
		getLeadingPlainText(params.metadata_name) ?? extractLeakedMetadataName(params.metadata_type) ?? ""

	return {
		metadata_type: metadataType,
		metadata_name: metadataName,
	}
}
