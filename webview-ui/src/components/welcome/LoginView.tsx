import { useCallback } from "react"
import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
// import { useAppTranslation } from "@src/i18n/TranslationContext"

import { Tab, TabContent } from "../common/Tab"
import RooHero from "./RooHero"

const LoginView = () => {
	// const { t } = useAppTranslation() // Commented out as not used yet

	const handleLogin = useCallback(() => {
		// Execute firebase authentication command
		vscode.postMessage({
			type: "executeCommand",
			commands: ["firebase-service.signIn"],
		} as any)
	}, [])

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5 p-16">
				<RooHero />
				<h2 className="mt-0 mb-0">Welcome to Siid-Code</h2>

				<div className="font-bold">
					<p>Please log in to continue using Siid Code with full features.</p>
				</div>

				<div className="flex flex-col gap-4 mt-8">
					<VSCodeButton onClick={handleLogin} appearance="primary">
						Login to Your Account
					</VSCodeButton>
				</div>

				<div className="text-sm text-vscode-descriptionForeground mt-4">
					<p>By logging in, you&apos;ll have access to:</p>
					<ul className="list-disc list-inside mt-2 space-y-1">
						<li>Advanced AI features</li>
						<li>Premium support</li>
					</ul>
				</div>
			</TabContent>
		</Tab>
	)
}

export default LoginView
