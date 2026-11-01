import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ArrowUp, ChevronLeft, ChevronRight, Folder, Monitor, Plus } from "lucide-react"

import { getAllModes } from "@roo/modes"
import { getModelsForMode } from "@roo/mode-models"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { ModelSelector } from "@/components/chat/ModelSelector"
import { MAX_IMAGES_PER_MESSAGE } from "@/components/chat/ChatView"
import { vscode } from "@/utils/vscode"

import { AgentsFlag } from "./AgentsFlag"
import { AGENTS_PORTAL_ID, basename, buildModelDetail } from "./agentsFormat"

/** Marker used so only this composer consumes the image picker response. */
const AGENTS_IMAGE_TS = -1

export const AgentsComposer = () => {
	const { t } = useAppTranslation()
	const {
		apiConfiguration,
		mode,
		customModes,
		autoApprovalEnabled,
		cwd,
		useFreeModels,
		developerMode,
		modeModelListVersion,
	} = useExtensionState()
	const selectedModel = useSelectedModel(apiConfiguration)
	const { info, isLoading } = selectedModel
	// Same value the sidebar's ModelSelector receives (ChatTextArea).
	const modelId = selectedModel.id || ""
	const portalContainer = useRooPortal(AGENTS_PORTAL_ID)

	const [text, setText] = useState("")
	const [images, setImages] = useState<string[]>([])
	const [chipsOpen, setChipsOpen] = useState(true)
	const [modeMenuOpen, setModeMenuOpen] = useState(false)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	const modes = getAllModes(customModes)
	const currentMode = modes.find((m) => m.slug === mode)
	const modeName = currentMode?.name ?? mode

	// The detail describes the model the picker names. When the stored model is not offered the
	// picker says "Select a model", so no detail is shown then, nor while model info is loading.
	const modelListed = useMemo(
		() =>
			getModelsForMode(mode).some(
				(m) => m.modelId === modelId && (developerMode || useFreeModels !== true || m.tier === "Free"),
			),
		// modeModelListVersion signals that the shared list was replaced.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[mode, modelId, useFreeModels, developerMode, modeModelListVersion],
	)
	const detail =
		!isLoading && info && modelListed
			? buildModelDetail({
					reasoningEffort: info.supportsReasoningEffort ? apiConfiguration?.reasoningEffort : undefined,
					reasoningEnabled: apiConfiguration?.enableReasoningEffort,
					contextWindow: info.contextWindow,
					contextLabel: t("agents:context"),
				})
			: undefined

	const handleModelChange = useCallback((id: string) => {
		vscode.postMessage({ type: "updateModel", text: id })
	}, [])

	// Held images cannot be sent to a model that does not take them.
	useEffect(() => {
		if (info && !info.supportsImages) {
			setImages((prev) => (prev.length > 0 ? [] : prev))
		}
	}, [info])

	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			const msg = e.data
			if (msg?.type === "selectedImages" && msg.context === "edit" && msg.messageTs === AGENTS_IMAGE_TS) {
				setImages((prev) => [...prev, ...(msg.images ?? [])].slice(0, MAX_IMAGES_PER_MESSAGE))
			}
		}
		window.addEventListener("message", onMessage)
		return () => window.removeEventListener("message", onMessage)
	}, [])

	useEffect(() => {
		const el = inputRef.current
		if (el) {
			el.style.height = "auto"
			el.style.height = `${Math.min(el.scrollHeight, 180)}px`
		}
	}, [text])

	const canSend = text.trim().length > 0 || images.length > 0

	const send = useCallback(() => {
		if (!canSend) {
			return
		}
		vscode.postMessage({ type: "newTask", text: text.trim(), images })
		setText("")
		setImages([])
	}, [canSend, text, images])

	const shouldDisableImages = !info?.supportsImages || images.length >= MAX_IMAGES_PER_MESSAGE
	const workspace = basename(cwd)

	return (
		<div className="agents-composer-wrap" data-testid="agents-composer">
			<div className="agents-chiprow">
				{chipsOpen && (
					<>
						<span className="agents-chip">
							<Monitor size={13} />
							<span>{t("agents:thisComputer")}</span>
						</span>
						{workspace && (
							<span className="agents-chip agents-chip-active" data-testid="agents-workspace-chip">
								<Folder size={13} />
								<span>{workspace}</span>
							</span>
						)}
					</>
				)}
				<button
					className="agents-icon-btn"
					style={{ width: 20, height: 20 }}
					aria-label={t("agents:collapseChips")}
					data-testid="agents-collapse"
					onClick={() => setChipsOpen((v) => !v)}>
					{chipsOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
				</button>
			</div>

			<div className="agents-composer">
				{images.length > 0 && (
					<div className="agents-thumbs">
						{images.map((src, i) => (
							<img key={i} src={src} alt="" />
						))}
					</div>
				)}
				<textarea
					ref={inputRef}
					className="agents-input"
					data-testid="agents-input"
					rows={1}
					autoFocus
					value={text}
					placeholder={t("agents:placeholder")}
					onChange={(e) => setText(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
							e.preventDefault()
							send()
						}
					}}
				/>

				<div className="agents-bar">
					<button
						className="agents-icon-btn agents-attach"
						aria-label={t("agents:attach")}
						data-testid="agents-attach"
						disabled={shouldDisableImages}
						onClick={() =>
							vscode.postMessage({ type: "selectImages", context: "edit", messageTs: AGENTS_IMAGE_TS })
						}>
						<Plus size={15} />
					</button>
					<Popover open={modeMenuOpen} onOpenChange={setModeMenuOpen}>
						<PopoverTrigger asChild>
							<button
								className="agents-pill agents-pill-mode"
								title={t("agents:changeMode")}
								data-testid="agents-mode">
								<span>{modeName}</span>
							</button>
						</PopoverTrigger>
						<PopoverContent align="start" container={portalContainer} className="agents-pop" role="menu">
							{modes.map((m) => (
								<button
									key={m.slug}
									role="menuitemradio"
									aria-checked={m.slug === mode}
									data-testid="agents-mode-option"
									onClick={() => {
										setModeMenuOpen(false)
										vscode.postMessage({ type: "mode", text: m.slug })
									}}>
									{m.name}
								</button>
							))}
						</PopoverContent>
					</Popover>
					<button
						className="agents-pill agents-muted"
						title={t("agents:togglePermissions")}
						data-testid="agents-permissions"
						aria-pressed={!!autoApprovalEnabled}
						onClick={() => vscode.postMessage({ type: "autoApprovalEnabled", bool: !autoApprovalEnabled })}>
						<span>{autoApprovalEnabled ? t("agents:autoApprove") : t("agents:manualPermissions")}</span>
					</button>
				</div>

				<div className="agents-bar">
					{modelId && (
						<span className="agents-model" data-testid="agents-model">
							<AgentsFlag />
							<ModelSelector
								value={modelId}
								mode={mode}
								onChange={handleModelChange}
								title={t("chat:selectModel", { defaultValue: "Select model" })}
								useFreeModels={useFreeModels}
								developerMode={developerMode}
								triggerClassName="agents-model-trigger"
								portalId={AGENTS_PORTAL_ID}
							/>
						</span>
					)}
					{detail && (
						<span className="agents-detail" data-testid="agents-model-detail">
							{detail}
						</span>
					)}
					<span className="agents-grow" />
					<button
						className="agents-send"
						aria-label={t("agents:send")}
						data-testid="agents-send"
						disabled={!canSend}
						onClick={send}>
						<ArrowUp size={15} />
					</button>
				</div>
			</div>
		</div>
	)
}

export default AgentsComposer
