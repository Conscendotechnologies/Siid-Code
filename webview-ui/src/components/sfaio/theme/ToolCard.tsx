import React, { ReactNode } from "react"
import { IconProps } from "@phosphor-icons/react"

export interface ToolCardProps {
	icon: React.FC<IconProps>
	title: string
	statusNode?: ReactNode
	children?: ReactNode
	className?: string
}

export function ToolCard({ icon: Icon, title, statusNode, children, className = "" }: ToolCardProps) {
	return (
		<div
			className={`flex flex-col gap-2 p-3 rounded-lg bg-[var(--color-surface)] border border-[var(--color-divider)] ${className}`}>
			<div className="flex items-center gap-2">
				<Icon className="w-4 h-4 text-[var(--color-accent)]" />
				<span className="text-[13px] font-heading font-medium flex-1">{title}</span>
				{statusNode && <div>{statusNode}</div>}
			</div>
			{children && <div className="text-[12px] opacity-80 pl-6">{children}</div>}
		</div>
	)
}
