import React from "react"

export interface LinearMeterProps {
	progress: number // 0 to 1
	className?: string
}

export function LinearMeter({ progress, className = "" }: LinearMeterProps) {
	const percentage = Math.min(Math.max(progress, 0), 1) * 100

	return (
		<div className={`h-[3px] bg-[var(--color-divider)] rounded-full overflow-hidden ${className}`}>
			<div
				className="h-full rounded-full transition-[width] duration-300 ease-out"
				style={{
					width: `${percentage}%`,
					background: "linear-gradient(to right, var(--color-accent-800), var(--color-accent))",
				}}
			/>
		</div>
	)
}
