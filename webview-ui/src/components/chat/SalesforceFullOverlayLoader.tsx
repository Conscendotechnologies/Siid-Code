import React from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"

export interface SalesforceIndexingProgress {
	phase: "DISCOVERING" | "RETRIEVING_METADATA" | "BUILDING_TRANSACTIONS" | "BUILDING_GRAPH" | "COMPLETE" | "ERROR"
	currentStep: number
	totalSteps: number
	currentFile?: string
	docType?: "APEX" | "TRIGGER" | "OBJECT" | "FLOW" | "VALIDATION" | "LWC" | "AURA" | "FLEXIPAGE" | "LAYOUT" | "OTHER"
	itemsProcessed: number
	totalItems: number
	nodeCount?: number
	edgeCount?: number
	timelineCount?: number
	durationMs?: number
	error?: string
}

interface SalesforceFullOverlayLoaderProps {
	progress: SalesforceIndexingProgress | null
	onClose: () => void
}

export const SalesforceFullOverlayLoader: React.FC<SalesforceFullOverlayLoaderProps> = ({ progress, onClose }) => {
	const { t } = useAppTranslation()
	if (!progress) return null

	const isComplete = progress.phase === "COMPLETE"
	const isError = progress.phase === "ERROR"

	const progressPercentage =
		progress.totalItems > 0
			? Math.min(100, Math.round((progress.itemsProcessed / progress.totalItems) * 100))
			: progress.phase === "BUILDING_TRANSACTIONS"
				? 85
				: progress.phase === "BUILDING_GRAPH"
					? 95
					: progress.phase === "COMPLETE"
						? 100
						: 5

	// Dynamic Icon selection based on docType or phase
	const renderCenterIcon = () => {
		if (isComplete) {
			return (
				<svg
					className="w-10 h-10 text-white animate-pulse"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2.8}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			)
		}
		if (isError) {
			return (
				<svg
					className="w-10 h-10 text-white"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					strokeWidth={2.8}>
					<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
				</svg>
			)
		}

		switch (progress.docType) {
			case "APEX":
				return <span className="text-white text-2xl font-bold font-mono">@</span>
			case "TRIGGER":
				return (
					<svg
						className="w-9 h-9 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2.2}>
						<path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
					</svg>
				)
			case "OBJECT":
				return (
					<svg
						className="w-9 h-9 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2.2}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
						/>
					</svg>
				)
			case "LWC":
			case "AURA":
				return (
					<svg
						className="w-9 h-9 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2.2}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
						/>
					</svg>
				)
			case "FLOW":
				return (
					<svg
						className="w-9 h-9 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2.2}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
						/>
					</svg>
				)
			case "FLEXIPAGE":
			case "LAYOUT":
				return (
					<svg
						className="w-9 h-9 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2.2}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
						/>
					</svg>
				)
			case "VALIDATION":
				return (
					<svg
						className="w-9 h-9 text-white"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2.2}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
						/>
					</svg>
				)
			default:
				return (
					<svg
						className="w-9 h-9 text-white animate-spin"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
						strokeWidth={2.2}>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
				)
		}
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={t("settings:codeIndex.salesforce.indexingProgress")}
			className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[var(--color-bg)] text-[var(--color-text)] font-sans p-6 select-none overflow-y-auto animate-fadeIn">
			{/* Soft Subtle Hexagon Pattern Background */}
			<div
				className="absolute inset-0 opacity-[0.25] dark:opacity-[0.10] pointer-events-none"
				style={{
					backgroundImage: `radial-gradient(var(--color-accent) 0.75px, transparent 0.75px), radial-gradient(var(--color-accent) 0.75px, transparent 0.75px)`,
					backgroundSize: `30px 30px`,
					backgroundPosition: `0 0, 15px 15px`,
				}}
			/>

			{/* Main Centered Content */}
			<div className="relative z-10 flex flex-col items-center max-w-md w-full text-center">
				{/* 7-Hexagon Honeycomb Visualizer Matching Reference Image */}
				<div className="relative w-80 h-72 mb-8 flex items-center justify-center">
					{/* SVG Honeycomb Net Render */}
					<svg
						className="w-full h-full filter drop-shadow-[0_12px_24px_rgba(59,98,209,0.12)]"
						viewBox="0 0 300 270"
						fill="none">
						{/* Outer Surrounding Soft White 3D Hexagons */}
						{/* Top Left (x: 75, y: 60) */}
						<polygon
							points="75,15 120,40 120,90 75,115 30,90 30,40"
							fill="var(--color-bg)"
							stroke="var(--color-divider)"
							strokeWidth="2.5"
						/>
						{/* Top Right (x: 225, y: 60) */}
						<polygon
							points="225,15 270,40 270,90 225,115 180,90 180,40"
							fill="var(--color-bg)"
							stroke="var(--color-divider)"
							strokeWidth="2.5"
						/>
						{/* Left (x: 25, y: 135) */}
						<polygon
							points="25,90 70,115 70,165 25,190 -20,165 -20,115"
							fill="var(--color-bg)"
							stroke="var(--color-divider)"
							strokeWidth="2.5"
						/>
						{/* Right (x: 275, y: 135) */}
						<polygon
							points="275,90 320,115 320,165 275,190 230,165 230,115"
							fill="var(--color-bg)"
							stroke="var(--color-divider)"
							strokeWidth="2.5"
						/>
						{/* Bottom Left (x: 75, y: 210) */}
						<polygon
							points="75,165 120,190 120,240 75,265 30,240 30,190"
							fill="var(--color-bg)"
							stroke="var(--color-divider)"
							strokeWidth="2.5"
						/>
						{/* Bottom Right (x: 225, y: 210) */}
						<polygon
							points="225,165 270,190 270,240 225,265 180,240 180,190"
							fill="var(--color-bg)"
							stroke="var(--color-divider)"
							strokeWidth="2.5"
						/>

						{/* Central Active Royal Blue Hexagon (Center at x: 150, y: 135) */}
						<polygon
							points="150,75 200,103 200,167 150,195 100,167 100,103"
							fill="url(#royalBlueGrad)"
							stroke="var(--color-accent)"
							strokeWidth="3"
						/>

						{/* Concentric Node Dots at Vertices of Central Hexagon */}
						<g>
							{/* Top Center Node */}
							<circle
								cx="150"
								cy="75"
								r="6"
								fill="var(--color-bg)"
								stroke="var(--color-accent)"
								strokeWidth="3"
							/>
							<circle cx="150" cy="75" r="2" fill="var(--color-accent)" />

							{/* Bottom Center Node */}
							<circle
								cx="150"
								cy="195"
								r="6"
								fill="var(--color-bg)"
								stroke="var(--color-accent)"
								strokeWidth="3"
							/>
							<circle cx="150" cy="195" r="2" fill="var(--color-accent)" />

							{/* Top Right Node */}
							<circle
								cx="200"
								cy="103"
								r="6"
								fill="var(--color-bg)"
								stroke="var(--color-accent)"
								strokeWidth="3"
							/>
							<circle cx="200" cy="103" r="2" fill="var(--color-accent)" />

							{/* Bottom Right Node */}
							<circle
								cx="200"
								cy="167"
								r="6"
								fill="var(--color-bg)"
								stroke="var(--color-accent)"
								strokeWidth="3"
							/>
							<circle cx="200" cy="167" r="2" fill="var(--color-accent)" />

							{/* Top Left Node */}
							<circle
								cx="100"
								cy="103"
								r="6"
								fill="var(--color-bg)"
								stroke="var(--color-accent)"
								strokeWidth="3"
							/>
							<circle cx="100" cy="103" r="2" fill="var(--color-accent)" />

							{/* Bottom Left Node */}
							<circle
								cx="100"
								cy="167"
								r="6"
								fill="var(--color-bg)"
								stroke="var(--color-accent)"
								strokeWidth="3"
							/>
							<circle cx="100" cy="167" r="2" fill="var(--color-accent)" />
						</g>

						{/* Linear Gradient Definitions */}
						<defs>
							<linearGradient id="royalBlueGrad" x1="0%" y1="0%" x2="100%" y2="100%">
								<stop offset="0%" stopColor="var(--color-accent)" />
								<stop offset="100%" stopColor="var(--color-accent-600)" />
							</linearGradient>
						</defs>
					</svg>

					{/* Center Icon Overlay */}
					<div className="absolute z-30 inset-0 flex items-center justify-center pointer-events-none">
						{renderCenterIcon()}
					</div>

					{/* Surrounding Hexagon Icons */}
					<div className="absolute top-10 left-[70px] text-[color-mix(in_srgb,var(--color-text)_40%,transparent)] pointer-events-none">
						<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
							/>
						</svg>
					</div>

					<div className="absolute top-10 right-[70px] text-[color-mix(in_srgb,var(--color-text)_40%,transparent)] pointer-events-none">
						<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
							/>
						</svg>
					</div>

					<div className="absolute bottom-10 left-[70px] text-[color-mix(in_srgb,var(--color-text)_40%,transparent)] pointer-events-none">
						<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
							/>
						</svg>
					</div>

					<div className="absolute bottom-10 right-[70px] text-[color-mix(in_srgb,var(--color-text)_40%,transparent)] pointer-events-none">
						<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
				</div>

				{/* Title Matching Reference Design ("Verifying emails" / "Cleaning prospect data") */}
				<h2 className="text-2xl font-normal text-[var(--color-text)] mb-2 tracking-tight">
					{isComplete
						? t("settings:codeIndex.salesforce.complete")
						: isError
							? "Indexing Error Occurred"
							: progress.phase === "DISCOVERING"
								? t("settings:codeIndex.salesforce.discovering")
								: progress.phase === "RETRIEVING_METADATA"
									? t("settings:codeIndex.salesforce.retrieving")
									: progress.phase === "BUILDING_TRANSACTIONS"
										? t("settings:codeIndex.salesforce.buildingTransactions")
										: progress.phase === "BUILDING_GRAPH"
											? t("settings:codeIndex.salesforce.buildingGraph")
											: "Indexing Salesforce Org"}
				</h2>

				{/* Live Badge for Current Item */}
				{progress.currentFile && !isComplete && (
					<div className="text-xs font-mono text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] mb-6 max-w-sm truncate">
						{progress.currentFile}
					</div>
				)}

				{/* Reference Image Smooth Light Blue Progress Bar Pill */}
				<div className="w-64 bg-[var(--color-divider)] rounded-full h-2 mb-6 overflow-hidden relative">
					<div
						className="bg-[var(--color-accent)] h-full rounded-full transition-all duration-300 relative"
						style={{ width: `${progressPercentage}%` }}
					/>
				</div>

				{/* Stats Row */}
				<div className="flex items-center justify-center gap-6 text-xs text-[color-mix(in_srgb,var(--color-text)_60%,transparent)] mb-6 font-mono">
					<span>
						{progress.itemsProcessed} / {progress.totalItems} items
					</span>
					<span className="font-semibold text-[var(--color-accent)]">{progressPercentage}%</span>
				</div>

				{/* Close / Background Button */}
				<div>
					<VSCodeButton appearance={isComplete ? "primary" : "secondary"} onClick={onClose}>
						{isComplete
							? t("settings:codeIndex.close")
							: t("settings:codeIndex.salesforce.runInBackground")}
					</VSCodeButton>
				</div>
			</div>
		</div>
	)
}
