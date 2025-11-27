import { useCallback, useState } from "react"
import { VSCodeButton, VSCodeCheckbox, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
// import { useAppTranslation } from "@src/i18n/TranslationContext"

import { Tab, TabContent } from "../common/Tab"
import RooHero from "./RooHero"

const LoginView = () => {
	// const { t } = useAppTranslation() // Commented out as not used yet
	const [useOwnApiKey, setUseOwnApiKey] = useState(false)
	const [customApiKey, setCustomApiKey] = useState("")

	const handleLogin = useCallback(() => {
		// Execute firebase authentication command with optional API key
		if (useOwnApiKey && customApiKey.trim()) {
			// User wants to use their own API key
			vscode.postMessage({
				type: "firebaseSignInWithApiKey",
				apiKey: customApiKey.trim(),
			} as any)
		} else {
			// Use auto-provisioned API key (default flow)
			vscode.postMessage({
				type: "executeCommand",
				commands: ["firebase-service.signIn"],
			} as any)
		}
	}, [useOwnApiKey, customApiKey])

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5 p-16">
				<RooHero />
				<h2 className="mt-0 mb-0">Welcome to Siid-Code</h2>

				<div className="font-bold">
					<p>Please log in to continue using Siid Code with full features.</p>
				</div>

				<div className="flex flex-col gap-4 mt-4">
					<VSCodeCheckbox checked={useOwnApiKey} onChange={(e: any) => setUseOwnApiKey(e.target.checked)}>
						<span className="font-medium">Use my own OpenRouter API key</span>
					</VSCodeCheckbox>

					{useOwnApiKey && (
						<div className="flex flex-col gap-2 ml-6">
							<VSCodeTextField
								value={customApiKey}
								type="password"
								onInput={(e: any) => setCustomApiKey(e.target.value)}
								placeholder="sk-or-v1-..."
								className="w-full">
								<label className="block text-sm font-medium mb-1">OpenRouter API Key</label>
							</VSCodeTextField>
							<p className="text-xs text-vscode-descriptionForeground">
								Get your API key from{" "}
								<a
									href="#"
									onClick={(e) => {
										e.preventDefault()
										vscode.postMessage({
											type: "openExternal",
											url: "https://openrouter.ai/keys",
										} as any)
									}}
									className="text-vscode-textLink-foreground hover:text-vscode-textLink-activeForeground">
									openrouter.ai/keys
								</a>
							</p>
						</div>
					)}
				</div>

				<div className="flex flex-col gap-4 mt-4">
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
