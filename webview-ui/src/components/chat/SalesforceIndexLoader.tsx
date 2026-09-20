import React from "react"
import { type SalesforceIndexingProgress } from "./SalesforceFullOverlayLoader"

interface SalesforceIndexLoaderProps {
	progress: SalesforceIndexingProgress | null
}

export const SalesforceIndexLoader: React.FC<SalesforceIndexLoaderProps> = ({ progress }) => {
	if (!progress) return null

	const percent =
		progress.totalItems > 0 ? Math.min(100, Math.round((progress.itemsProcessed / progress.totalItems) * 100)) : 0
	const isComplete = progress.phase === "COMPLETE"
	const isError = progress.phase === "ERROR"

	return (
		<div className="my-3 p-3.5 rounded-xl bg-[var(--color-surface)] border border-[var(--color-divider)] shadow-sm text-[var(--color-text)] font-sans transition-all duration-300">
			<div className="flex items-center gap-3 mb-2">
				{/* Mini Honeycomb SVG Icon */}
				<div className="relative w-8 h-8 flex items-center justify-center shrink-0">
					<svg className="w-full h-full" viewBox="0 0 100 115" fill="none">
						<polygon points="50,2 98,28 98,87 50,113 2,87 2,28" fill="var(--color-accent)" />
					</svg>
					<span className="absolute z-10 text-white text-xs font-bold font-mono">
						{isComplete ? "✓" : isError ? "!" : "⚡"}
					</span>
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-center justify-between text-xs font-medium text-[var(--color-text)]">
						<span className="truncate">
							{isComplete
								? "Indexing Complete"
								: isError
									? "Indexing Error"
									: progress.phase === "DISCOVERING"
										? "SF CLI Org Retrieval..."
										: progress.phase === "RETRIEVING_METADATA"
											? "Parsing org metadata..."
											: "Mapping transactions..."}
						</span>
						<span className="font-semibold text-[var(--color-accent)] ml-2">{percent}%</span>
					</div>

					{/* File Stream Badge */}
					{progress.currentFile && !isComplete && (
						<div className="text-[10px] font-mono text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] truncate">
							{progress.currentFile}
						</div>
					)}
				</div>
			</div>

			{/* Salesforce Blue Pill Progress Bar */}
			<div className="w-full bg-[var(--color-divider)] rounded-full h-1.5 overflow-hidden">
				<div
					className="bg-[var(--color-accent)] h-full rounded-full transition-all duration-300"
					style={{ width: `${percent}%` }}
				/>
			</div>

			{/* Items & Stats Row */}
			<div className="flex items-center justify-between mt-2 text-[10px] text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] font-mono">
				<span>
					{progress.itemsProcessed} / {progress.totalItems} items
				</span>
				{progress.nodeCount !== undefined && progress.nodeCount > 0 && (
					<span>
						Nodes: {progress.nodeCount} | Timelines: {progress.timelineCount || 0}
					</span>
				)}
			</div>
		</div>
	)
}
