import React, { ReactNode } from "react"

export interface SectionLabelProps {
	children: ReactNode
	className?: string
}

export function SectionLabel({ children, className = "" }: SectionLabelProps) {
	return (
		<div className={`flex items-center gap-3 ${className}`}>
			<span className="text-[9px] uppercase tracking-[0.16em] text-[color-mix(in_srgb,var(--color-text)_55%,transparent)] font-medium">
				{children}
			</span>
			<div
				className="flex-1 h-[1px]"
				style={{
					background: "linear-gradient(to right, var(--color-divider) 0%, transparent 100%)",
				}}
			/>
		</div>
	)
}
