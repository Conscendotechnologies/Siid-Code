export type RunState =
	| "SETUP"
	| "ANALYZING"
	| "AWAITING_ALIGNMENT"
	| "AWAITING_DESIGN_APPROVAL"
	| "EXECUTING"
	| "COMPLETED"
	| "FAILED"
	| "PAUSED"
	| "CANCELLED"

export type TaskState =
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

export type AgentRole = "Architect" | "Senior" | "Mid" | "Junior"

export interface ModelConfig {
	provider: string
	modelId: string
	settings?: Record<string, any>
}

export interface Agent {
	id: string
	role: AgentRole
	modelConfig: ModelConfig
	currentTaskId?: string
	retriesUsed: number
	tokensTotal: number
	costTotal: number
}

export interface Task {
	id: string
	runId: string
	wave: number
	assignedTier: AgentRole
	assignedAgentId?: string
	objective: string
	filesOwned: string[]
	filesReadOnly: string[]
	interfaces: string
	acceptanceCriteria: string
	constraints: string
	generatorFlags?: string
	instructions: string
	state: TaskState
	createdAt: number
	updatedAt: number
}

export interface Run {
	id: string
	state: RunState
	targetOrg: string
	autoMode: boolean
	modelsPerRole: Record<AgentRole, ModelConfig>
	poolSize: number
	budgetCap?: number
	createdAt: number
	updatedAt: number
}

export interface DeployQueueItem {
	id: string
	taskId: string
	status: "WAITING" | "DEPLOYING" | "FAILED" | "DONE"
	createdAt: number
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
	files: Record<string, string> // path -> content or path -> shadow copy location
	lastModifiedDates: Record<string, string> // path -> date from org
	createdAt: number
}

export interface EventLog {
	id: string
	timestamp: number
	actor: string
	entityType: "Run" | "Task" | "Agent" | "DeployQueueItem"
	entityId: string
	fromState?: string
	toState?: string
	reason?: string
}

export interface SfaioState {
	runs: Record<string, Run>
	tasks: Record<string, Task>
	agents: Record<string, Agent>
	deployQueue: Record<string, DeployQueueItem>
	escalations: Record<string, Escalation>
	snapshots: Record<string, Snapshot>
	eventLogs: Record<string, EventLog>
}
