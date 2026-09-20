import React from "react"
import * as Portal from "@radix-ui/react-portal"

export interface SfaioPortalProps extends React.ComponentProps<typeof Portal.Root> {
	children: React.ReactNode
}

/**
 * A wrapper around Radix Portal that applies the SFAIO theme data attribute.
 * Since Radix renders portals to document.body by default, they escape the
 * [data-sfaio-theme] context block and lose all theme tokens. This wrapper
 * ensures the theme attribute is reapplied at the portal root.
 */
export function SfaioPortal({ children, ...props }: SfaioPortalProps) {
	return (
		<Portal.Root {...props}>
			<div data-sfaio-theme data-sfaio-portal className="contents">
				{children}
			</div>
		</Portal.Root>
	)
}
