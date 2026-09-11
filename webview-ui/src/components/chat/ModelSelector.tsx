import React from "react"
import { useEvent } from "react-use"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { getModelsForMode, getRecommendedModelForMode } from "@roo/mode-models"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"
import { Mode } from "@roo/modes"
import { ExtensionMessage } from "@roo/ExtensionMessage"

type CustomProviderInfo = {
	apiProvider?: string
	openAiBaseUrl?: string
	openAiApiKey?: string
	openAiHeaders?: Record<string, string>
}

interface ModelSelectorProps {
	value: string // Current model ID
	mode: Mode // Current mode to determine available models
	onChange: (modelId: string) => void
	disabled?: boolean
	title?: string
	triggerClassName?: string
	useFreeModels?: boolean // Filter to show only free models
	developerMode?: boolean // Developer mode shows all models
	customProvider?: CustomProviderInfo // When apiProvider is a custom endpoint (openai), fetch models from it
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
	customProvider,
}: ModelSelectorProps) => {
	const [open, setOpen] = React.useState(false)
	const [customModels, setCustomModels] = React.useState<string[] | null>(null)
	const portalContainer = useRooPortal("roo-portal")
	const { t } = useAppTranslation()
	const { modeModelListVersion } = useExtensionState()

	// Opening the picker is the moment the list has to be right, so it doubles
	// as the refresh trigger. The extension throttles, so reopening is cheap.
	const handleOpenChange = React.useCallback((isOpen: boolean) => {
		setOpen(isOpen)
		if (isOpen) {
			vscode.postMessage({ type: "refreshModeModelList" })
		}
	}, [])
	const formatTierLabel = React.useCallback((tier: string) => {
		if (!tier) return tier
		return tier.charAt(0).toUpperCase() + tier.slice(1)
	}, [])

	const isCustomEndpoint = customProvider?.apiProvider === "openai" && !!customProvider.openAiBaseUrl

	// Fetch models from the custom endpoint when the popover opens
	React.useEffect(() => {
		if (!open || !isCustomEndpoint) return
		vscode.postMessage({
			type: "requestOpenAiModels",
			values: {
				baseUrl: customProvider!.openAiBaseUrl,
				apiKey: customProvider!.openAiApiKey,
				openAiHeaders: customProvider!.openAiHeaders,
			},
		})
	}, [open, isCustomEndpoint, customProvider])

	const onMessage = React.useCallback(
		(event: MessageEvent) => {
			if (!isCustomEndpoint) return
			const message: ExtensionMessage = event.data
			if (message.type === "openAiModels") {
				setCustomModels(message.openAiModels ?? [])
			}
		},
		[isCustomEndpoint],
	)
	useEvent("message", onMessage)

	// Get available models for the current mode with filtering
	const availableModels = React.useMemo(() => {
		// Custom endpoint (9Router/OmniRoute): show the endpoint's model list
		if (isCustomEndpoint) {
			const ids = customModels ?? (value ? [value] : [])
			return ids.map((id) => ({ modelId: id, displayName: id, tier: "" as string, priority: 999 }))
		}

		const allModels = getModelsForMode(mode)

		// The recommended model is per-mode, so the suffix is added here rather
		// than baked into the shared list's display names. Names already ending
		// in a parenthetical ("GLM 4.5 Air (Free)") absorb the suffix; others
		// get their own so the result never has an unbalanced paren.
		const recommended = getRecommendedModelForMode(mode)
		const withSuffix = (name: string) =>
			name.endsWith(")") ? `${name.slice(0, -1)}, Recommended)` : `${name} (Recommended)`
		const labelled = recommended
			? allModels.map((model) =>
					model.modelId === recommended ? { ...model, displayName: withSuffix(model.displayName) } : model,
				)
			: allModels

		// Developer mode shows all models
		if (developerMode) {
			return labelled
		}

		// Show only free tier models when useFreeModels is enabled,
		// otherwise show everything (free and paid)
		return useFreeModels === true ? labelled.filter((model) => model.tier === "Free") : labelled
		// modeModelListVersion is the signal that the shared list was replaced.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mode, useFreeModels, developerMode, modeModelListVersion, isCustomEndpoint, customModels, value])

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

	// A stored model that is no longer offered (delisted by the provider, or
	// filtered out) has no entry to name. Prompt for a new one rather than
	// showing a bare id, and never switch on the user's behalf.
	const displayName = selectedModel?.displayName || t("chat:modelSelector.selectModel")

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
		<Popover open={open} onOpenChange={handleOpenChange}>
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
														model.tier === "Free" && "bg-green-500/20 text-green-300",
														model.tier === "Basic" && "bg-blue-500/20 text-blue-300",
														model.tier === "Medium" && "bg-purple-500/20 text-purple-300",
														model.tier === "Advanced" && "bg-orange-500/20 text-orange-300",
														model.tier === "Premium" && "bg-red-500/20 text-red-300",
													)}>
													{formatTierLabel(model.tier)}
												</span>
											)}
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
