import { z } from "zod"

/**
 * HistoryItem
 */

export const historyItemSchema = z.object({
	id: z.string(),
	number: z.number(),
	ts: z.number(),
	task: z.string(),
	tokensIn: z.number(),
	tokensOut: z.number(),
	cacheWrites: z.number().optional(),
	cacheReads: z.number().optional(),
	totalCost: z.number(),
	size: z.number().optional(),
	workspace: z.string().optional(),
	mode: z.string().optional(),
	// Task time tracking - stores elapsed duration in milliseconds
	duration: z.number().optional(),
	// Task completion status - true when task has finished
	taskCompleted: z.boolean().optional(),
	// Subtask relationship - stores parent task ID for persistence across window reloads
	parentTaskId: z.string().optional(),
	rootTaskId: z.string().optional(),
})

export type HistoryItem = z.infer<typeof historyItemSchema>
