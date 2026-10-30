import React, { useCallback, useEffect, useState } from "react"
import { ChevronDown, ChevronRight, FileDiff, FileText } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

import { basename } from "./agentsFormat"

type PaneTab = "changes" | "files"

interface DirEntry {
	name: string
	path: string
	isDirectory: boolean
}
interface Change {
	path: string
	absPath: string
	status: string
}

const TreeNode = ({
	entry,
	listings,
	expanded,
	toggle,
}: {
	entry: DirEntry
	listings: Record<string, DirEntry[]>
	expanded: Set<string>
	toggle: (p: string) => void
}) => {
	const open = expanded.has(entry.path)
	return (
		<div>
			<button
				className="agents-tree-row"
				data-testid={entry.isDirectory ? "agents-dir" : "agents-file"}
				onClick={() =>
					entry.isDirectory
						? toggle(entry.path)
						: vscode.postMessage({ type: "agentsOpenFile", text: entry.path })
				}>
				{entry.isDirectory ? (
					open ? (
						<ChevronDown size={12} />
					) : (
						<ChevronRight size={12} />
					)
				) : (
					<span style={{ width: 12 }} />
				)}
				<span>{entry.name}</span>
			</button>
			{entry.isDirectory && open && (
				<div className="agents-tree-children">
					{(listings[entry.path] ?? []).map((child) => (
						<TreeNode
							key={child.path}
							entry={child}
							listings={listings}
							expanded={expanded}
							toggle={toggle}
						/>
					))}
				</div>
			)}
		</div>
	)
}

export const AgentsRightPane = () => {
	const { t } = useAppTranslation()
	const { cwd, clineMessages } = useExtensionState()
	const [tab, setTab] = useState<PaneTab>("files")
	const [root, setRoot] = useState<{ name: string; path: string } | undefined>()
	const [listings, setListings] = useState<Record<string, DirEntry[]>>({})
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [changes, setChanges] = useState<Change[]>([])
	const [changesError, setChangesError] = useState<string | undefined>()
	const [changesLoaded, setChangesLoaded] = useState(false)

	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			const msg = e.data
			if (msg?.type === "agentsDirListing" && msg.payload) {
				const { path, root: r, entries } = msg.payload
				if (r) {
					setRoot(r)
					setExpanded((prev) => new Set(prev).add(r.path))
				}
				setListings((prev) => ({ ...prev, [path]: entries ?? [] }))
			} else if (msg?.type === "agentsChanges" && msg.payload) {
				setChanges(msg.payload.changes ?? [])
				setChangesError(msg.payload.error)
				setChangesLoaded(true)
			}
		}
		window.addEventListener("message", onMessage)
		vscode.postMessage({ type: "agentsListDir", text: "" })
		return () => window.removeEventListener("message", onMessage)
	}, [])

	const refreshChanges = useCallback(() => vscode.postMessage({ type: "agentsGetChanges" }), [])

	const messageCount = clineMessages?.length ?? 0
	useEffect(() => {
		if (tab === "changes") {
			refreshChanges()
		}
	}, [tab, messageCount, refreshChanges])

	const toggle = useCallback((p: string) => {
		setExpanded((prev) => {
			const next = new Set(prev)
			if (next.has(p)) {
				next.delete(p)
			} else {
				next.add(p)
				vscode.postMessage({ type: "agentsListDir", text: p })
			}
			return next
		})
	}, [])

	const rootOpen = root ? expanded.has(root.path) : false

	return (
		<aside className="agents-right" data-testid="agents-right">
			<div className="agents-tabbar" role="tablist">
				<button
					className="agents-tab"
					role="tab"
					aria-selected={tab === "changes"}
					data-testid="agents-tab-changes"
					onClick={() => setTab("changes")}>
					<FileDiff size={13} />
					{t("agents:changes")}
				</button>
				<button
					className="agents-tab"
					role="tab"
					aria-selected={tab === "files"}
					data-testid="agents-tab-files"
					onClick={() => setTab("files")}>
					<FileText size={13} />
					{t("agents:files")}
				</button>
			</div>

			<div className="agents-pane">
				{tab === "files" &&
					(root ? (
						<div>
							<button className="agents-tree-row" onClick={() => toggle(root.path)}>
								{rootOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
								<span>{root.name || basename(cwd)}</span>
							</button>
							{rootOpen && (
								<div className="agents-tree-children">
									{(listings[root.path] ?? []).map((entry) => (
										<TreeNode
											key={entry.path}
											entry={entry}
											listings={listings}
											expanded={expanded}
											toggle={toggle}
										/>
									))}
								</div>
							)}
						</div>
					) : (
						<div className="agents-note">{t("agents:noWorkspace")}</div>
					))}

				{tab === "changes" && (
					<div data-testid="agents-changes">
						{changesError && <div className="agents-note">{t("agents:changesError")}</div>}
						{!changesError && changesLoaded && changes.length === 0 && (
							<div className="agents-note">{t("agents:noChanges")}</div>
						)}
						{changes.map((c) => (
							<button
								key={c.absPath}
								className="agents-change"
								data-testid="agents-change"
								title={c.path}
								onClick={() => vscode.postMessage({ type: "agentsOpenDiff", text: c.absPath })}>
								<span className="agents-badge" data-s={c.status} title={t(`agents:status.${c.status}`)}>
									{c.status === "?" ? "U" : c.status}
								</span>
								<span className="agents-path">{c.path}</span>
							</button>
						))}
					</div>
				)}
			</div>
		</aside>
	)
}

export default React.memo(AgentsRightPane)
