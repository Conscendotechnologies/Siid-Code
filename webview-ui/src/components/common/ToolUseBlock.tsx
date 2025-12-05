import { cn } from "@/lib/utils"

import { CODE_BLOCK_BG_COLOR } from "./CodeBlock"

export const ToolUseBlock = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn("overflow-hidden border border-vscode-border rounded-xs p-1 cursor-pointer", className)}
		style={{
			backgroundColor: CODE_BLOCK_BG_COLOR,
			marginBottom: 4,
		}}
		{...props}
	/>
)

export const ToolUseBlockHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
	<div
		className={cn(
			"flex items-center select-none text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors cursor-pointer",
			className,
		)}
		style={{ padding: "4px 8px", borderRadius: "3px" }}
		{...props}
	/>
)
