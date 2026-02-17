import { useEffect, useRef } from "react"
import { CaretDownIcon, CaretUpIcon, CounterClockwiseClockIcon } from "@radix-ui/react-icons"
import { useTranslation } from "react-i18next"
import MarkdownBlock from "../common/MarkdownBlock"

interface ReasoningBlockProps {
	content: string
	elapsed?: number
	isCollapsed?: boolean
	onToggleCollapse?: () => void
}

export const ReasoningBlock = ({ content, elapsed, isCollapsed = true, onToggleCollapse }: ReasoningBlockProps) => {
	const elapsedRef = useRef<number>(0)

	const { t } = useTranslation("chat")

	useEffect(() => {
		// Intentionally do not render or reveal internal reasoning content
		// Only track elapsed time for display
	}, [content])

	useEffect(() => {
		if (elapsed) {
			elapsedRef.current = elapsed
		}
	}, [elapsed])

	// Always render the reasoning block so users can see assistant reasoning

	return (
		<div className="bg-vscode-editor-background border border-vscode-border rounded-xs overflow-hidden">
			<div className="flex items-center justify-between gap-1 px-3 py-2 text-muted-foreground">
				<div className="truncate flex-1 flex items-center gap-2">
					<button
						onClick={onToggleCollapse}
						className="shrink-0 min-h-[20px] min-w-[20px] p-[2px] cursor-pointer opacity-85 hover:opacity-100 bg-transparent border-none rounded-md"
						aria-label={isCollapsed ? "Expand reasoning" : "Collapse reasoning"}>
						{isCollapsed ? <CaretDownIcon className="scale-80" /> : <CaretUpIcon className="scale-80" />}
					</button>
					<span>{t("chat:reasoning.thinking")}</span>
				</div>
				<div className="flex flex-row items-center gap-1">
					{elapsedRef.current > 1000 && (
						<>
							<CounterClockwiseClockIcon className="scale-80" />
							<div>{t("reasoning.seconds", { count: Math.round(elapsedRef.current / 1000) })}</div>
						</>
					)}
				</div>
			</div>
			{!isCollapsed && (
				<div style={{ padding: "12px 16px", backgroundColor: "var(--vscode-editor-background)" }}>
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
