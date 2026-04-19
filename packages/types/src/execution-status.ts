import { z } from "zod"

export const sfRetrieveExecutionStatusSchema = z.discriminatedUnion("status", [
	z.object({
		executionId: z.string(),
		status: z.literal("retrieving"),
		metadataType: z.string(),
		metadataName: z.string().optional(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("completed"),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("error"),
		error: z.string().optional(),
	}),
])

export type SfRetrieveExecutionStatus = z.infer<typeof sfRetrieveExecutionStatusSchema>

export const sfDeployExecutionStatusSchema = z.discriminatedUnion("status", [
	z.object({
		executionId: z.string(),
		status: z.literal("validating"),
		metadataType: z.string(),
		metadataName: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("deploying"),
		metadataType: z.string(),
		metadataName: z.string(),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("completed"),
	}),
	z.object({
		executionId: z.string(),
		status: z.literal("error"),
		error: z.string().optional(),
	}),
])

export type SfDeployExecutionStatus = z.infer<typeof sfDeployExecutionStatusSchema>
