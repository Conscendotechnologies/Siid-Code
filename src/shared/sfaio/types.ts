export type RunState =
	| "SETUP"
	| "ANALYZING"
	| "AWAITING_ALIGNMENT"
	| "AWAITING_DESIGN_APPROVAL"
	| "AWAITING_DELEGATION_APPROVAL" // added in §2.6
	| "EXECUTING"
	| "COMPLETED"
	| "FAILED"
	| "PAUSED"
	| "CANCELLED"

export type SfaioTaskState =
	| "PENDING"
	| "ASSIGNED"
	| "IN_PROGRESS"
	| "DRY_RUN"
	| "QUEUED"
	| "DEPLOYING"
	| "IN_REVIEW"
	| "DONE"
	| "FAILED"
	| "ESCALATED"
	| "REASSIGNED"
	| "ROLLED_BACK"
	| "PAUSED"
	| "CANCELLED"

export type AgentTier = "architect" | "senior" | "mid" | "junior"

export interface TaskSpec {
	taskId: string
	wave: number
	assignedTier: AgentTier
	objective: string
	filesOwned: string[] // exclusive; enforced by fileRegex (Phase 0 §0.3)
	filesReadOnly: string[]
	contracts: {
		methodSignatures?: string[]
		fieldApiNames?: string[]
		notes?: string
	}
	acceptanceCriteria: string[]
	constraints: string[] // standards chosen during alignment
	generatorFlags?: Record<string, string>
	instructions: string // tier-dependent depth
	metadataTypes: string[] // drives deploy ordering + instruction lookup
}

export interface SfaioTask {
	taskId: string
	runId: string
	state: SfaioTaskState
	spec: TaskSpec
	assignedAgentId?: string
	engineTaskId?: string // the engine Task currently executing this
	selfRetryCount: number // Phase 4
	reviewCount: number // Phase 4
	snapshotId?: string // Phase 4
	deployResult?: DeployResult
	costUsd?: number // Phase 5
	tokensIn?: number
	tokensOut?: number
	createdAt: number
	updatedAt: number
}

export interface Run {
	runId: string
	state: RunState
	requirement: string
	targetOrgAlias: string
	projectPath: string
	designDocPath?: string
	alignmentAnswers?: Record<string, string>
	autoMode: boolean // skips permission gates, never safety stops
	isGreenfieldOrg: boolean // decides whether alignment can be auto-answered
	budgetCapUsd?: number // Phase 5
	waves: number
	createdAt: number
	updatedAt: number
}

export interface AgentRecord {
	agentId: string
	runId: string
	tier: AgentTier
	profileName: string // provider-profile name, never a model id
	currentTaskId?: string
	status: "IDLE" | "BUSY" | "PAUSED" | "DEAD"
	lastHeartbeat: number // Phase 4
	tokensIn: number
	tokensOut: number
	costUsd: number
}

export interface DeployResult {
	success: boolean
	cliCommand: string
	rawOutput: string // truncated
	errorSnippet?: string
	componentsDeployed?: number
	finishedAt: number
}

export interface DeployQueueItem {
	itemId: string
	runId: string
	taskId: string
	orgAlias: string
	priority: number // Architect-assigned deploy order
	enqueuedAt: number
	state: "WAITING" | "DEPLOYING" | "DONE" | "FAILED"
	result?: DeployResult
}

export interface DecisionItem {
	decisionId: string
	runId: string
	kind:
		| "ALIGNMENT"
		| "DESIGN_APPROVAL"
		| "DELEGATION_APPROVAL"
		| "ESCALATION"
		| "BUDGET_PAUSE"
		| "FRESHNESS_CONFLICT"
		| "DESTRUCTIVE_ROLLBACK_APPROVAL" // Phase 4 §4.5 — never auto-approvable
	prompt: string
	payload?: unknown // e.g. the design doc path, the task graph, the escalation
	createdAt: number
	resolvedAt?: number
	response?: { decision: "APPROVE" | "REJECT" | "ANSWER"; text?: string }
}

export interface Escalation {
	id: string
	taskId: string
	agentId: string
	blocker: string
	fileLineLocation: string
	cliError?: string
	attemptedFixes: string
	proposedSolution: string
	resolved: boolean
	architectResponse?: string
	createdAt: number
}

export interface Snapshot {
	id: string
	taskId: string
	files: Record<string, string>
	lastModifiedDates: Record<string, string>
	createdAt: number
}

export interface EventLog {
	id: string
	timestamp: number
	actor: string
	entityType: "Run" | "Task" | "Agent" | "DeployQueueItem" | "Decision" | "System"
	entityId: string
	fromState?: string
	toState?: string
	reason?: string
}

export interface SfaioState {
	runs: Record<string, Run>
	tasks: Record<string, SfaioTask>
	agents: Record<string, AgentRecord>
	deployQueue: Record<string, DeployQueueItem>
	escalations: Record<string, Escalation>
	snapshots: Record<string, Snapshot>
	eventLogs: Record<string, EventLog>
	decisions: Record<string, DecisionItem>
}
