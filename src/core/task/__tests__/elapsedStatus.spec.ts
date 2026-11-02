import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { startElapsedStatus } from "../elapsedStatus"

describe("startElapsedStatus", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const render = (seconds: number) => `Thinking (${seconds}s)...`

	it("reports immediately, then each second, until stopped", () => {
		const update = vi.fn().mockResolvedValue(undefined)
		const stop = startElapsedStatus({ render, update })

		expect(update.mock.calls.map(([text]) => text)).toEqual(["Thinking (0s)..."])

		vi.advanceTimersByTime(2000)
		expect(update.mock.calls.map(([text]) => text)).toEqual([
			"Thinking (0s)...",
			"Thinking (1s)...",
			"Thinking (2s)...",
		])

		stop()
		vi.advanceTimersByTime(5000)
		expect(update).toHaveBeenCalledTimes(3)
	})

	it("stops itself when shouldStop turns true", () => {
		const update = vi.fn().mockResolvedValue(undefined)
		let aborted = false

		startElapsedStatus({ render, update, shouldStop: () => aborted })
		aborted = true
		vi.advanceTimersByTime(5000)

		expect(update).toHaveBeenCalledTimes(1)
	})

	it("survives a failing status update", async () => {
		const update = vi.fn().mockRejectedValue(new Error("webview gone"))
		const stop = startElapsedStatus({ render, update })

		await vi.advanceTimersByTimeAsync(1000)

		expect(update).toHaveBeenCalledTimes(2)
		stop()
	})
})
