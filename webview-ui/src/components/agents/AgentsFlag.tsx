/** The Conscendo corner flag from the brand guide; takes its colour from `color`. */
export const AgentsFlag = ({ className = "agents-flag", size = 12 }: { className?: string; size?: number }) => (
	<svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
		<polygon points="0,0 100,0 100,100 76,76 76,24 24,24" fill="currentColor" />
	</svg>
)
