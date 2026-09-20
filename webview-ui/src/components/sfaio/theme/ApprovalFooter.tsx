import React from "react"
import { Check, X } from "@phosphor-icons/react"

export interface ApprovalFooterProps {
	onApprove: () => void
	onReject: () => void
	isApproveDisabled?: boolean
	isRejectDisabled?: boolean
}

export function ApprovalFooter({
	onApprove,
	onReject,
	isApproveDisabled = false,
	isRejectDisabled = false,
}: ApprovalFooterProps) {
	return (
		<div className="flex items-center gap-2 pt-3 border-t border-[var(--color-divider)] mt-2">
			<button
				onClick={onApprove}
				disabled={isApproveDisabled}
				className="flex-1 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm font-heading font-medium border border-[var(--color-accent)] text-[var(--color-accent)] hover:bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] active:bg-[color-mix(in_srgb,var(--color-accent)_22%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
				<Check weight="bold" />
				Approve
			</button>
			<button
				onClick={onReject}
				disabled={isRejectDisabled}
				className="w-24 inline-flex items-center justify-center gap-2 h-9 px-3 rounded-[var(--radius-md)] text-sm font-heading font-medium border border-[var(--color-divider)] text-[var(--color-text)] hover:bg-[color-mix(in_srgb,var(--color-text)_7%,transparent)] active:bg-[color-mix(in_srgb,var(--color-text)_14%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
				<X weight="bold" />
				Reject
			</button>
		</div>
	)
}
