import React from "react"
import { IconProps } from "@phosphor-icons/react"
import { CheckCircle, WarningCircle, Warning, Clock, Check, XCircle, Spinner } from "@phosphor-icons/react"

export type TaskState = "success" | "attention" | "danger" | "idle" | "active" | "waiting" | "spent"

export interface StateChipProps {
	state: TaskState
	label: string
	className?: string
}

export function StateChip({ state, label, className = "" }: StateChipProps) {
	const Icon = getIconForState(state)
	const isSpent = state === "spent"

	return (
		<div
			className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStateClasses(state)} ${className}`}>
			<Icon weight="bold" className={`w-3.5 h-3.5 ${state === "active" ? "animate-spin" : ""}`} />
			<span className={isSpent ? "line-through opacity-70" : ""}>{label}</span>
		</div>
	)
}

function getIconForState(state: TaskState): React.FC<IconProps> {
	switch (state) {
		case "success":
			return CheckCircle
		case "attention":
			return Warning
		case "danger":
			return WarningCircle
		case "idle":
			return Clock
		case "active":
			return Spinner
		case "waiting":
			return Clock // or Hourglass
		case "spent":
			return XCircle
		default:
			return Check
	}
}

function getStateClasses(state: TaskState): string {
	switch (state) {
		case "success":
			return "bg-[var(--state-success-bg)] text-[var(--state-success-fg)] border-[var(--state-success-border)]"
		case "attention":
			return "bg-[var(--state-attention-bg)] text-[var(--state-attention-fg)] border-[var(--state-attention-border)]"
		case "danger":
			return "bg-[var(--state-danger-bg)] text-[var(--state-danger-fg)] border-[var(--state-danger-border)]"
		case "idle":
			return "bg-[var(--state-idle-bg)] text-[var(--state-idle-fg)] border-[var(--state-idle-border)]"
		case "active":
			return "bg-[var(--state-active-bg)] text-[var(--state-active-fg)] border-[var(--state-active-border)]"
		case "waiting":
			return "bg-[var(--state-waiting-bg)] text-[var(--state-waiting-fg)] border-[var(--state-waiting-border)]"
		case "spent":
			return "bg-[var(--state-spent-bg)] text-[var(--state-spent-fg)] border-[var(--state-spent-border)]"
		default:
			return ""
	}
}
