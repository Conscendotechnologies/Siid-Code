import React, { useMemo, useState } from "react"
import { Ellipsis, ListFilter, Plus, Search } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { StandardTooltip } from "@/components/ui/standard-tooltip"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui"
import { useRooPortal } from "@/components/ui/hooks/useRooPortal"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

import { AgentsFlag } from "./AgentsFlag"
import { AGENTS_PORTAL_ID, filterSessions } from "./agentsFormat"
import conscendoLogo from "./assets/conscendo-logo.png?inline"

interface AgentsRailProps {
	onNewSession: () => void
	onOpenCustomizations: () => void
	onOpenHistory: () => void
}

export const AgentsRail = ({ onNewSession, onOpenCustomizations, onOpenHistory }: AgentsRailProps) => {
	const { t } = useAppTranslation()
	const { taskHistory, currentTaskItem, cwd } = useExtensionState()
	const [query, setQuery] = useState("")
	const [searchOpen, setSearchOpen] = useState(false)
	const [workspaceOnly, setWorkspaceOnly] = useState(false)
	const [menuOpen, setMenuOpen] = useState(false)
	const portalContainer = useRooPortal(AGENTS_PORTAL_ID)

	const sessions = useMemo(
		() => filterSessions(taskHistory ?? [], { query, workspaceOnly, cwd }),
		[taskHistory, query, workspaceOnly, cwd],
	)

	return (
		<nav className="agents-rail" data-testid="agents-rail">
			<img className="agents-logo" src={conscendoLogo} alt="Conscendo" />
			<button className="agents-rail-row agents-primary" data-testid="agents-new-session" onClick={onNewSession}>
				<Plus size={15} />
				<span className="agents-grow">{t("agents:newSession")}</span>
				<span className="agents-kbd" aria-hidden="true">
					<span>Ctrl</span>
					<i>+</i>
					<span>N</span>
				</span>
			</button>

			<StandardTooltip content={t("agents:comingSoon")} side="right">
				<span>
					<button
						className="agents-rail-row"
						data-testid="agents-automations"
						aria-disabled="true"
						tabIndex={-1}
						onClick={(e) => e.preventDefault()}>
						<AgentsFlag />
						<span className="agents-grow">{t("agents:automations")}</span>
					</button>
				</span>
			</StandardTooltip>

			<button className="agents-rail-row" data-testid="agents-customizations" onClick={onOpenCustomizations}>
				<AgentsFlag />
				<span className="agents-grow">{t("agents:customizations")}</span>
			</button>

			<div className="agents-sessions-header">
				<span className="agents-grow">{t("agents:sessions")}</span>
				<StandardTooltip content={t("agents:filterSessions")}>
					<button
						className="agents-icon-btn"
						aria-label={t("agents:filterSessions")}
						aria-pressed={workspaceOnly}
						data-testid="agents-filter"
						onClick={() => setWorkspaceOnly((v) => !v)}>
						<ListFilter size={14} />
					</button>
				</StandardTooltip>
				<StandardTooltip content={t("agents:searchSessions")}>
					<button
						className="agents-icon-btn"
						aria-label={t("agents:searchSessions")}
						aria-pressed={searchOpen}
						data-testid="agents-search-toggle"
						onClick={() => {
							setSearchOpen((v) => !v)
							if (searchOpen) {
								setQuery("")
							}
						}}>
						<Search size={14} />
					</button>
				</StandardTooltip>
				<Popover open={menuOpen} onOpenChange={setMenuOpen}>
					<PopoverTrigger asChild>
						<button
							className="agents-icon-btn"
							aria-label={t("agents:moreActions")}
							data-testid="agents-more">
							<Ellipsis size={14} />
						</button>
					</PopoverTrigger>
					<PopoverContent align="end" container={portalContainer} className="agents-pop">
						<button
							data-testid="agents-open-history"
							onClick={() => {
								setMenuOpen(false)
								onOpenHistory()
							}}>
							{t("agents:openHistory")}
						</button>
					</PopoverContent>
				</Popover>
			</div>

			{searchOpen && (
				<input
					className="agents-search"
					data-testid="agents-search"
					autoFocus
					value={query}
					placeholder={t("agents:searchPlaceholder")}
					onChange={(e) => setQuery(e.target.value)}
				/>
			)}

			<div className="agents-sessions">
				<div className="agents-rail-row agents-chats-row" style={{ cursor: "default" }}>
					<span className="agents-grow">{t("agents:chats")}</span>
				</div>
				{sessions.length === 0 && <div className="agents-empty">{t("agents:noSessions")}</div>}
				{sessions.map((item) => (
					<button
						key={item.id}
						className="agents-session"
						data-testid="agents-session"
						title={item.task}
						aria-current={currentTaskItem?.id === item.id ? true : undefined}
						onClick={() => vscode.postMessage({ type: "showTaskWithId", text: item.id })}>
						<span>{item.task}</span>
					</button>
				))}
			</div>
		</nav>
	)
}

export default React.memo(AgentsRail)
