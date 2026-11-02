/**
 * Reports a status text immediately and then once per interval with the elapsed
 * seconds, until the returned function is called or `shouldStop` turns true.
 */
export function startElapsedStatus({
	render,
	update,
	shouldStop,
	intervalMs = 1000,
}: {
	render: (elapsedSeconds: number) => string
	update: (text: string) => Promise<unknown>
	shouldStop?: () => boolean
	intervalMs?: number
}): () => void {
	const startedAt = Date.now()

	// A failed status update must never affect the request it describes.
	const report = () => {
		update(render(Math.floor((Date.now() - startedAt) / 1000))).catch(() => {})
	}

	report()

	const timer = setInterval(() => {
		if (shouldStop?.()) {
			clearInterval(timer)
			return
		}

		report()
	}, intervalMs)

	// Don't let a stream that never settles keep the extension host alive.
	timer.unref?.()

	return () => clearInterval(timer)
}
