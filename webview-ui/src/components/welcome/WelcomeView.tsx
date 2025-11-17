import { useCallback, useState } from "react"
import knuthShuffle from "knuth-shuffle-seeded"
import { Trans } from "react-i18next"
import { VSCodeButton, VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import type { ProviderSettings } from "@siid-code/types"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { validateApiConfiguration } from "@src/utils/validate"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { getRequestyAuthUrl, getOpenRouterAuthUrl } from "@src/oauth/urls"

import ApiOptions from "../settings/ApiOptions"
import { Tab, TabContent } from "../common/Tab"

import RooHero from "./RooHero"

const WelcomeView = () => {
	const { showWelcome, setShowWelcome, uriScheme, machineId } = useExtensionState()
	const { t } = useAppTranslation()
	const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined)

	const handleSubmit = useCallback(() => {
		setShowWelcome(false)
	}, [setShowWelcome])

	// Using a lazy initializer so it reads once at mount
	const [imagesBaseUri] = useState(() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5 p-16">
				<RooHero />
				<h2 className="mt-0 mb-0">{t("welcome:greeting")}</h2>

				<div className="font-bold">
					<p>
						<Trans i18nKey="welcome:introduction" />
					</p>
				</div>
			</TabContent>
			<div className="sticky bottom-0 bg-vscode-sideBar-background p-5">
				<div className="flex flex-col gap-1">
					<div className="flex justify-end">
						<VSCodeLink
							href="#"
							onClick={(e) => {
								e.preventDefault()
								vscode.postMessage({ type: "importSettings" })
							}}
							className="text-sm">
							{t("welcome:importSettings")}
						</VSCodeLink>
					</div>
					<VSCodeButton onClick={handleSubmit} appearance="primary">
						{t("welcome:start")}
					</VSCodeButton>
					{errorMessage && <div className="text-vscode-errorForeground">{errorMessage}</div>}
				</div>
			</div>
		</Tab>
	)
}

export default WelcomeView
