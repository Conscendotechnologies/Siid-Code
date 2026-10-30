import React, { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUp, ChevronLeft, ChevronRight, Folder, Lock, Monitor, Plus } from "lucide-react"

import { getAllModes } from "@roo/modes"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { useSelectedModel } from "@/components/ui/hooks/useSelectedModel"
import { vscode } from "@/utils/vscode"

import { AgentsFlag } from "./AgentsFlag"
import { basename, buildModelDetail, providerLabel } from "./agentsFormat"

interface AgentsComposerProps {
	onOpenSettings: () => void
}

/** Marker used so only this composer consumes the image picker response. */
const AGENTS_IMAGE_TS = -1

export const AgentsComposer = ({ onOpenSettings }: AgentsComposerProps) => {
	const { t } = useAppTranslation()
	const { apiConfiguration, mode, customModes, autoApprovalEnabled, cwd } = useExtensionState()
	const { id: modelId, info } = useSelectedModel(apiConfiguration)

	const [text, setText] = useState("")
	const [images, setImages] = useState<string[]>([])
	const [chipsOpen, setChipsOpen] = useState(true)
	const [modeMenuOpen, setModeMenuOpen] = useState(false)
	const inputRef = useRef<HTMLTextAreaElement>(null)

	const modes = getAllModes(customModes)
	const currentMode = modes.find((m) => m.slug === mode)
	const modeName = currentMode?.name ?? mode

	const detail = buildModelDetail({
		reasoningEffort: apiConfiguration?.reasoningEffort,
		reasoningEnabled: apiConfiguration?.enableReasoningEffort,
		contextWindow: info?.contextWindow,
		maxLabel: t("agents:max"),
	})

	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			const msg = e.data
			if (msg?.type === "selectedImages" && msg.context === "edit" && msg.messageTs === AGENTS_IMAGE_TS) {
				setImages((prev) => [...prev, ...(msg.images ?? [])].slice(0, 20))
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

	const provider = providerLabel(apiConfiguration?.apiProvider)
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
						{provider && (
							<span
								className="agents-chip"
								data-testid="agents-provider-chip"
								title={t("agents:provider")}>
								<Lock size={13} />
								<span>{provider}</span>
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

				<div className="agents-bar" style={{ position: "relative" }}>
					<button
						className="agents-icon-btn agents-attach"
						aria-label={t("agents:attach")}
						data-testid="agents-attach"
						onClick={() =>
							vscode.postMessage({ type: "selectImages", context: "edit", messageTs: AGENTS_IMAGE_TS })
						}>
						<Plus size={15} />
					</button>
					<button
						className="agents-pill agents-pill-mode"
						title={t("agents:changeMode")}
						data-testid="agents-mode"
						onClick={() => setModeMenuOpen((v) => !v)}>
						<span>{modeName}</span>
					</button>
					<button
						className="agents-pill agents-muted"
						title={t("agents:togglePermissions")}
						data-testid="agents-permissions"
						aria-pressed={!!autoApprovalEnabled}
						onClick={() => vscode.postMessage({ type: "autoApprovalEnabled", bool: !autoApprovalEnabled })}>
						<span>{autoApprovalEnabled ? t("agents:autoApprove") : t("agents:manualPermissions")}</span>
					</button>
					{modeMenuOpen && (
						<div className="agents-menu" style={{ top: 30, left: 36 }} role="menu">
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
						</div>
					)}
				</div>

				<div className="agents-bar">
					<button
						className="agents-pill"
						title={t("agents:model")}
						data-testid="agents-model"
						onClick={onOpenSettings}>
						<AgentsFlag />
						<span>{modelId}</span>
					</button>
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
