import React, { ReactNode } from "react"
import { IconProps } from "@phosphor-icons/react"

export interface ModalShellProps {
	icon: React.FC<IconProps>
	title: string
	statusPill?: ReactNode
	children: ReactNode
	isOpen: boolean
	onClose?: () => void
}

export function ModalShell({ icon: Icon, title, statusPill, children, isOpen, onClose }: ModalShellProps) {
	if (!isOpen) return null

	return (
		<div
			className="fixed inset-0 z-50 grid place-items-center p-4 bg-[color-mix(in_srgb,var(--color-neutral-900)_50%,transparent)]"
			onClick={onClose}>
			<div
				className="w-full max-w-[440px] flex flex-col gap-3 p-4 rounded-[var(--radius-lg)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] border border-[var(--color-divider)]"
				style={{ animation: "siidRise 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
				onClick={(e) => e.stopPropagation()}>
				<div className="flex items-center gap-2">
					<div className="w-8 h-8 rounded-full bg-[var(--color-bg)] border border-[var(--color-divider)] flex items-center justify-center shrink-0">
						<Icon className="w-4 h-4 text-[var(--color-accent)]" weight="bold" />
					</div>
					<h2 className="font-heading font-medium text-lg text-[var(--color-text)] flex-1 m-0 leading-none">
						{title}
					</h2>
					{statusPill && <div>{statusPill}</div>}
				</div>
				<div className="text-sm opacity-85 mt-2">{children}</div>
			</div>
		</div>
	)
}
