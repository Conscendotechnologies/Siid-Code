import React from "react"

export interface DonutMeterProps {
	progress: number // 0 to 1
	className?: string
	size?: number
}

export function DonutMeter({ progress, className = "", size = 16 }: DonutMeterProps) {
	const percentage = Math.min(Math.max(progress, 0), 1)
	const radius = size / 2 - 1.5 // 1.5 is half the stroke width (3)
	const circumference = 2 * Math.PI * radius
	const strokeDashoffset = circumference - percentage * circumference

	return (
		<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={`transform -rotate-90 ${className}`}>
			<circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-divider)" strokeWidth="3" />
			<circle
				cx={size / 2}
				cy={size / 2}
				r={radius}
				fill="none"
				stroke="var(--color-accent)"
				strokeWidth="3"
				strokeLinecap="round"
				strokeDasharray={circumference}
				strokeDashoffset={strokeDashoffset}
				className="transition-[stroke-dashoffset] duration-300 ease-out"
			/>
		</svg>
	)
}
