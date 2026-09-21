import { RunState, SfaioTaskState } from "../../../shared/sfaio/types"

const TASK_TRANSITIONS: Record<SfaioTaskState, SfaioTaskState[]> = {
	PENDING: ["ASSIGNED", "CANCELLED"],
	ASSIGNED: ["IN_PROGRESS", "PENDING", "CANCELLED"],
	IN_PROGRESS: ["DRY_RUN", "FAILED", "ESCALATED", "PAUSED", "CANCELLED"],
	DRY_RUN: ["QUEUED", "IN_PROGRESS", "FAILED", "ESCALATED"],
	QUEUED: ["DEPLOYING", "PAUSED", "CANCELLED"],
	DEPLOYING: ["IN_REVIEW", "FAILED", "ESCALATED"],
	IN_REVIEW: ["DONE", "IN_PROGRESS", "FAILED"],
	DONE: ["ROLLED_BACK"],
	FAILED: ["ASSIGNED", "REASSIGNED", "CANCELLED"],
	ESCALATED: ["ASSIGNED", "REASSIGNED", "IN_PROGRESS", "CANCELLED"],
	REASSIGNED: ["ASSIGNED"],
	ROLLED_BACK: [],
	PAUSED: ["IN_PROGRESS", "QUEUED", "CANCELLED"],
	CANCELLED: [],
}

export function assertTaskTransition(from: SfaioTaskState, to: SfaioTaskState): void {
	if (!TASK_TRANSITIONS[from].includes(to)) {
		throw new Error(`[SFAIO] illegal task transition ${from} -> ${to}`)
	}
}

const RUN_TRANSITIONS: Record<RunState, RunState[]> = {
	SETUP: ["ANALYZING", "CANCELLED"],
	ANALYZING: ["AWAITING_ALIGNMENT", "AWAITING_DESIGN_APPROVAL", "FAILED", "CANCELLED"],
	AWAITING_ALIGNMENT: ["AWAITING_DESIGN_APPROVAL", "ANALYZING", "FAILED", "CANCELLED"],
	AWAITING_DESIGN_APPROVAL: ["AWAITING_DELEGATION_APPROVAL", "ANALYZING", "FAILED", "CANCELLED"],
	AWAITING_DELEGATION_APPROVAL: ["EXECUTING", "ANALYZING", "FAILED", "CANCELLED"],
	EXECUTING: ["COMPLETED", "FAILED", "PAUSED", "CANCELLED"],
	COMPLETED: [],
	FAILED: [],
	PAUSED: ["EXECUTING", "CANCELLED"],
	CANCELLED: [],
}

export function assertRunTransition(from: RunState, to: RunState): void {
	if (!RUN_TRANSITIONS[from].includes(to)) {
		throw new Error(`[SFAIO] illegal run transition ${from} -> ${to}`)
	}
}
