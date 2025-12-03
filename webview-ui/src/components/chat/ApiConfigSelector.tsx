import React, { useState, useMemo, useCallback } from "react"
import { cn } from "@/lib/utils"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger, StandardTooltip } from "@/components/ui"
import { IconButton } from "./IconButton"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { vscode } from "@/utils/vscode"
import { Fzf } from "fzf"
import { Button } from "@/components/ui"

interface ApiConfigSelectorProps {
	value: string
	displayName: string
	disabled?: boolean
	title?: string
	onChange: (value: string) => void
	triggerClassName?: string
	listApiConfigMeta: Array<{ id: string; name: string }>
	mode?: string
	pinnedApiConfigs?: Record<string, boolean>
	togglePinnedApiConfig: (id: string) => void
	useFreeModels?: boolean
	developerMode?: boolean
}

export const ApiConfigSelector = ({
	value,
	displayName,
	disabled = false,
	title = "",
	onChange,
	triggerClassName = "",
	listApiConfigMeta,
	mode,
	pinnedApiConfigs,
	togglePinnedApiConfig,
	useFreeModels = false,
	developerMode = false,
}: ApiConfigSelectorProps) => {
	const { t } = useAppTranslation()
	const [open, setOpen] = useState(false)
	const [searchValue, setSearchValue] = useState("")
	const portalContainer = useRooPortal("roo-portal")

	// If a mode is provided, only show the mode-specific basic/medium/advanced configs
	// If useFreeModels is true, only show configs ending with -free
	// If developerMode is enabled, always include the default config
	const modeFilteredList = useMemo(() => {
		let filtered = listApiConfigMeta

		if (mode) {
			const allowedNames = [`${mode}-basic-free`, `${mode}-medium`, `${mode}-advanced`]

			// If developer mode is enabled, also allow the default config
			if (developerMode) {
				allowedNames.push("default")
			}

			filtered = filtered.filter((c) => allowedNames.includes(c.name ?? ""))
		}

		if (useFreeModels) {
			// Filter for free configs, but keep default if developer mode is enabled
			filtered = filtered.filter((c) => {
				const name = c.name ?? ""
				return name.endsWith("-free") || (developerMode && name === "default")
			})
		}

		return filtered
	}, [listApiConfigMeta, mode, useFreeModels, developerMode])

	// Create searchable items for fuzzy search
	const searchableItems = useMemo(() => {
		return modeFilteredList.map((config) => ({
			original: config,
			searchStr: config.name,
		}))
	}, [modeFilteredList])

	// Create Fzf instance
	const fzfInstance = useMemo(() => {
		return new Fzf(searchableItems, {
			selector: (item) => item.searchStr,
		})
	}, [searchableItems])

	// Filter configs based on search
	const filteredConfigs = useMemo(() => {
		if (!searchValue) return modeFilteredList

		const matchingItems = fzfInstance.find(searchValue).map((result) => result.item.original)
		return matchingItems
	}, [modeFilteredList, searchValue, fzfInstance])

	// Separate pinned and unpinned configs
	const { pinnedConfigs, unpinnedConfigs } = useMemo(() => {
		const pinned = filteredConfigs.filter((config) => pinnedApiConfigs?.[config.id])
		const unpinned = filteredConfigs.filter((config) => !pinnedApiConfigs?.[config.id])
		return { pinnedConfigs: pinned, unpinnedConfigs: unpinned }
	}, [filteredConfigs, pinnedApiConfigs])

	const handleSelect = useCallback(
		(configId: string) => {
			onChange(configId)
			setOpen(false)
			setSearchValue("")
		},
		[onChange],
	)

	const handleEditClick = useCallback(() => {
		vscode.postMessage({
			type: "switchTab",
			tab: "settings",
		})
		setOpen(false)
	}, [])

	const renderConfigItem = useCallback(
		(config: { id: string; name: string }, isPinned: boolean) => {
			const isCurrentConfig = config.id === value

			return (
				<div
					key={config.id}
					onClick={() => handleSelect(config.id)}
					className={cn(
						"px-3 py-1.5 text-sm cursor-pointer flex items-center group",
						"hover:bg-vscode-list-hoverBackground",
						isCurrentConfig &&
							"bg-vscode-list-activeSelectionBackground text-vscode-list-activeSelectionForeground",
					)}>
					<span className="flex-1 truncate">{config.name}</span>
					<div className="flex items-center gap-1">
						{isCurrentConfig && (
							<div className="size-5 p-1 flex items-center justify-center">
								<span className="codicon codicon-check text-xs" />
							</div>
						)}
						<StandardTooltip content={isPinned ? t("chat:unpin") : t("chat:pin")}>
							<Button
								variant="ghost"
								size="icon"
								tabIndex={-1}
								onClick={(e) => {
									e.stopPropagation()
									togglePinnedApiConfig(config.id)
									vscode.postMessage({
										type: "toggleApiConfigPin",
										text: config.id,
									})
								}}
								className={cn("size-5 flex items-center justify-center", {
									"opacity-0 group-hover:opacity-100": !isPinned && !isCurrentConfig,
									"bg-accent opacity-100": isPinned,
								})}>
								<span className="codicon codicon-pin text-xs opacity-50" />
							</Button>
						</StandardTooltip>
					</div>
				</div>
			)
		},
		[value, handleSelect, t, togglePinnedApiConfig],
	)

	const triggerContent = (
		<PopoverTrigger
			disabled={disabled}
			data-testid="dropdown-trigger"
			className={cn(
				"w-full min-w-0 max-w-full inline-flex items-center gap-1.5 relative whitespace-nowrap px-1.5 py-1 text-xs",
				"bg-transparent border border-[rgba(255,255,255,0.08)] rounded-md text-vscode-foreground",
				"transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder focus-visible:ring-inset",
				disabled
					? "opacity-50 cursor-not-allowed"
					: "opacity-90 hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)] hover:border-[rgba(255,255,255,0.15)] cursor-pointer",
				triggerClassName,
			)}>
			<span
				className={cn(
					"codicon codicon-chevron-up pointer-events-none opacity-80 flex-shrink-0 text-xs transition-transform duration-200",
					open && "rotate-180",
				)}
			/>
			<span className="truncate">{displayName}</span>
		</PopoverTrigger>
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			{title ? <StandardTooltip content={title}>{triggerContent}</StandardTooltip> : triggerContent}
			<PopoverContent
				align="start"
				sideOffset={4}
				container={portalContainer}
				className="p-0 overflow-hidden w-[300px]">
				<div className="flex flex-col w-full">
					{/* Search input or info blurb */}
					{modeFilteredList.length > 6 ? (
						<div className="relative p-2 border-b border-vscode-dropdown-border">
							<input
								aria-label={t("common:ui.search_placeholder")}
								value={searchValue}
								onChange={(e) => setSearchValue(e.target.value)}
								placeholder={t("common:ui.search_placeholder")}
								className="w-full h-8 px-2 py-1 text-xs bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded focus:outline-0"
								autoFocus
							/>
							{searchValue.length > 0 && (
								<div className="absolute right-4 top-0 bottom-0 flex items-center justify-center">
									<span
										className="codicon codicon-close text-vscode-input-foreground opacity-50 hover:opacity-100 text-xs cursor-pointer"
										onClick={() => setSearchValue("")}
									/>
								</div>
							)}
						</div>
					) : (
						<div className="p-3 border-b border-vscode-dropdown-border">
							<p className="text-xs text-vscode-descriptionForeground m-0">
								{t("prompts:apiConfiguration.select")}
							</p>
						</div>
					)}

					{/* Config list */}
					<div className="max-h-[300px] overflow-y-auto">
						{filteredConfigs.length === 0 && searchValue ? (
							<div className="py-2 px-3 text-sm text-vscode-foreground/70">
								{t("common:ui.no_results")}
							</div>
						) : (
							<div className="py-1">
								{/* Pinned configs */}
								{pinnedConfigs.map((config) => renderConfigItem(config, true))}

								{/* Separator between pinned and unpinned */}
								{pinnedConfigs.length > 0 && unpinnedConfigs.length > 0 && (
									<div className="mx-1 my-1 h-px bg-vscode-dropdown-foreground/10" />
								)}

								{/* Unpinned configs */}
								{unpinnedConfigs.map((config) => renderConfigItem(config, false))}
							</div>
						)}
					</div>

					{/* Bottom bar with buttons on left and title on right */}
					<div className="flex flex-row items-center justify-between p-2 border-t border-vscode-dropdown-border">
						<div className="flex flex-row gap-1">
							<IconButton
								iconClass="codicon-settings-gear"
								title={t("chat:edit")}
								onClick={handleEditClick}
							/>
						</div>

						{/* Info icon and title on the right with matching spacing */}
						<div className="flex items-center gap-1 pr-1">
							{modeFilteredList.length > 6 && (
								<StandardTooltip content={t("prompts:apiConfiguration.select")}>
									<span className="codicon codicon-info text-xs text-vscode-descriptionForeground opacity-70 hover:opacity-100 cursor-help" />
								</StandardTooltip>
							)}
							<h4 className="m-0 font-medium text-sm text-vscode-descriptionForeground">
								{t("prompts:apiConfiguration.title")}
							</h4>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
