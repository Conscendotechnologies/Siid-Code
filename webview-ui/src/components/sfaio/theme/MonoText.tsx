import React, { ReactNode } from "react"

export interface MonoTextProps {
	children: ReactNode
	className?: string
}

export function MonoText({ children, className = "" }: MonoTextProps) {
	return (
		<span
			className={`font-mono text-[0.9em] bg-[var(--vscode-textCodeBlock-background)] px-1 rounded ${className}`}>
			{children}
		</span>
	)
}
