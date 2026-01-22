import React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getModelsForMode } from "@roo/mode-models"
import { Mode } from "@roo/modes"

interface ModelSelectorProps {
	value: string // Current model ID
	mode: Mode // Current mode to determine available models
	onChange: (modelId: string) => void
	disabled?: boolean
	title?: string
	triggerClassName?: string
	useFreeModels?: boolean // Filter to show only free models
	developerMode?: boolean // Developer mode shows all models
}

export const ModelSelector = ({
	value,
	mode,
	onChange,
	disabled = false,
	title = "",
	triggerClassName = "",
	useFreeModels = false,
	developerMode = false,
}: ModelSelectorProps) => {
	const [open, setOpen] = React.useState(false)
	const portalContainer = useRooPortal("roo-portal")
	const { t } = useAppTranslation()

	// Get available models for the current mode with filtering
	const availableModels = React.useMemo(() => {
		const allModels = getModelsForMode(mode)

		// Developer mode shows all models
		if (developerMode) {
			// Sort by priority for developer mode too
			return [...allModels].sort((a, b) => (a.priority || 999) - (b.priority || 999))
		}

		// Filter based on useFreeModels setting
		let filtered: typeof allModels
		if (useFreeModels === true) {
			// Show only free tier models when useFreeModels is enabled
			filtered = allModels.filter((model) => model.tier === "free")
		} else {
			// Show all models when useFreeModels is false (both free and paid)
			filtered = allModels
		}

		// Sort by priority (lower number = higher priority)
		return [...filtered].sort((a, b) => (a.priority || 999) - (b.priority || 999))
	}, [mode, useFreeModels, developerMode])

	// Find the selected model info
	const selectedModel = React.useMemo(() => {
		return availableModels.find((model) => model.modelId === value)
	}, [availableModels, value])

	const handleSelect = React.useCallback(
		(modelId: string) => {
			onChange(modelId)
			setOpen(false)
		},
		[onChange],
	)

	// If no models available for this mode, don't render
	if (availableModels.length === 0) {
		return null
	}

	const displayName = selectedModel?.displayName || value

	const triggerContent = (
		<PopoverTrigger
			disabled={disabled}
			data-testid="model-selector-trigger"
			className={cn(
				"w-[150px] inline-flex items-center px-2 py-1 text-xs",
				"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md",
				"text-vscode-foreground",
				"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
				disabled
					? "opacity-50 cursor-not-allowed"
					: "opacity-85 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
				triggerClassName,
			)}>
			<span
				className={cn(
					"codicon codicon-chevron-up pointer-events-none opacity-80 flex-shrink-0 text-xs transition-transform duration-200 mr-1.5",
					open && "rotate-180",
				)}
			/>
			<span className="truncate max-w-[200px]">{displayName}</span>
		</PopoverTrigger>
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{title ? <StandardTooltip content={title}>{triggerContent}</StandardTooltip> : triggerContent}
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden w-[280px]">
				<div className="flex flex-col w-full">
					{/* Header */}
					<div className="p-3 border-b border-vscode-dropdown-border">
						<p className="text-xs text-vscode-descriptionForeground m-0">
							{t("chat:selectModel", { defaultValue: "Select a model" })}
						</p>
					</div>

					{/* Model list */}
					<div className="max-h-[400px] overflow-y-auto py-1">
						{availableModels.map((model) => {
							const isSelected = model.modelId === value

							return (
								<div
									key={model.modelId}
									onClick={() => handleSelect(model.modelId)}
									className={cn(
										"px-3 py-2 text-sm cursor-pointer flex items-start justify-between group",
										"hover:bg-vscode-list-hoverBackground",
										isSelected &&
											"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
									)}>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<span className="font-medium truncate">{model.displayName}</span>
											{model.tier && (
												<span
													className={cn(
														"text-[10px] px-1.5 py-0.5 rounded",
														model.tier === "free" && "bg-green-500/20 text-green-300",
														model.tier === "basic" && "bg-blue-500/20 text-blue-300",
														model.tier === "medium" && "bg-purple-500/20 text-purple-300",
														model.tier === "advanced" && "bg-orange-500/20 text-orange-300",
													)}>
													{model.tier}
												</span>
											)}
										</div>
										<div className="text-xs text-vscode-descriptionForeground mt-0.5 truncate">
											{model.modelId}
										</div>
									</div>
									{isSelected && (
										<div className="size-5 p-1 flex items-center justify-center flex-shrink-0">
											<Check className="w-3 h-3" />
										</div>
									)}
								</div>
							)
						})}
					</div>

					{/* Footer */}
					<div className="p-2 border-t border-vscode-dropdown-border">
						<div className="flex items-center justify-between">
							<div className="text-xs text-vscode-descriptionForeground">
								{availableModels.length}{" "}
								{t("chat:modelsAvailable", { defaultValue: "models available" })}
							</div>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
