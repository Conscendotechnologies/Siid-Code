import React, { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, ChevronRight, FileDiff, FileText } from "lucide-react"

import { useAppTranslation } from "@/i18n/TranslationContext"
import { useExtensionState } from "@/context/ExtensionStateContext"
import { vscode } from "@/utils/vscode"

import { basename, isTaskRunning } from "./agentsFormat"
import summitPartnerBadge from "./assets/salesforce-summit-partner.webp?inline"

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

/** Quiet period before a message burst turns into one refresh. */
const REFRESH_DEBOUNCE_MS = 1000

export const AgentsRightPane = ({ drawerOpen = false }: { drawerOpen?: boolean }) => {
	const { t } = useAppTranslation()
	const { cwd, clineMessages } = useExtensionState()
	const [tab, setTab] = useState<PaneTab>("files")
	const [root, setRoot] = useState<{ name: string; path: string } | undefined>()
	const [listings, setListings] = useState<Record<string, DirEntry[]>>({})
	const [expanded, setExpanded] = useState<Set<string>>(new Set())
	const [changes, setChanges] = useState<Change[]>([])
	const [changesError, setChangesError] = useState<string | undefined>()
	const [notRepo, setNotRepo] = useState(false)
	const [changesLoaded, setChangesLoaded] = useState(false)

	// Requests in flight, so a burst of messages never stacks duplicate calls.
	const pendingDirs = useRef(new Set<string>())
	const changesPending = useRef(false)
	const expandedRef = useRef(expanded)
	expandedRef.current = expanded
	const rootRef = useRef(root)
	rootRef.current = root

	useEffect(() => {
		const onMessage = (e: MessageEvent) => {
			const msg = e.data
			if (msg?.type === "agentsDirListing" && msg.payload) {
				const { path, root: r, entries } = msg.payload
				pendingDirs.current.delete(path)
				pendingDirs.current.delete(r ? "" : path)
				if (r) {
					setRoot(r)
					// Only the first listing opens the root; refreshes keep the user's expansion.
					if (!rootRef.current) {
						setExpanded((prev) => new Set(prev).add(r.path))
					}
				}
				setListings((prev) => ({ ...prev, [path]: entries ?? [] }))
			} else if (msg?.type === "agentsChanges" && msg.payload) {
				changesPending.current = false
				setChanges(msg.payload.changes ?? [])
				setChangesError(msg.payload.error)
				setNotRepo(!!msg.payload.notRepo)
				setChangesLoaded(true)
			}
		}
		window.addEventListener("message", onMessage)
		pendingDirs.current.add("")
		vscode.postMessage({ type: "agentsListDir", text: "" })
		return () => window.removeEventListener("message", onMessage)
	}, [])

	const requestDir = useCallback((p: string) => {
		if (pendingDirs.current.has(p)) {
			return
		}
		pendingDirs.current.add(p)
		vscode.postMessage({ type: "agentsListDir", text: p })
	}, [])

	const refreshFiles = useCallback(() => {
		const r = rootRef.current
		if (!r) {
			return
		}
		requestDir(r.path)
		expandedRef.current.forEach((p) => p !== r.path && requestDir(p))
	}, [requestDir])

	const refreshChanges = useCallback(() => {
		if (changesPending.current) {
			return
		}
		changesPending.current = true
		vscode.postMessage({ type: "agentsGetChanges" })
	}, [])

	const running = isTaskRunning(clineMessages)
	const messages = clineMessages
	const wasRunning = useRef(running)

	// Debounced refresh while the agent works: files it creates and changes it makes show up.
	useEffect(() => {
		const timer = setTimeout(() => {
			if (tab === "files") {
				refreshFiles()
			} else {
				refreshChanges()
			}
		}, REFRESH_DEBOUNCE_MS)
		return () => clearTimeout(timer)
	}, [messages, tab, refreshFiles, refreshChanges])

	// Immediate refresh when the tab or drawer becomes visible, and when a task finishes.
	useEffect(() => {
		if (tab === "changes") {
			changesPending.current = false
			refreshChanges()
		} else {
			refreshFiles()
		}
	}, [tab, drawerOpen, refreshChanges, refreshFiles])
	useEffect(() => {
		if (wasRunning.current && !running) {
			refreshChanges()
			refreshFiles()
		}
		wasRunning.current = running
	}, [running, refreshChanges, refreshFiles])

	const toggle = useCallback(
		(p: string) => {
			setExpanded((prev) => {
				const next = new Set(prev)
				if (next.has(p)) {
					next.delete(p)
				} else {
					next.add(p)
					requestDir(p)
				}
				return next
			})
		},
		[requestDir],
	)

	const rootOpen = root ? expanded.has(root.path) : false
	const partnerBadge = (
		<div className="agents-partner">
			<img src={summitPartnerBadge} alt="Salesforce Summit Partner" />
		</div>
	)

	return (
		<aside className={`agents-right${drawerOpen ? " agents-right-open" : ""}`} data-testid="agents-right">
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
						{notRepo && <div className="agents-note">{t("agents:notRepo")}</div>}
						{!notRepo && changesError && <div className="agents-note">{t("agents:changesError")}</div>}
						{!notRepo && !changesError && changesLoaded && changes.length === 0 && (
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

			{partnerBadge}
		</aside>
	)
}

export default React.memo(AgentsRightPane)
