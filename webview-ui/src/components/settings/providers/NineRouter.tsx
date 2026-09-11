import { useCallback, useState, useEffect, useRef } from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { type ProviderSettings, type OrganizationAllowList, nineRouterDefaultModelId } from "@siid-code/types"
import { RouterName } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Button } from "@src/components/ui"
import { VSCodeButtonLink } from "@src/components/common/VSCodeButtonLink"

import { inputEventTransform } from "../transforms"
import { ModelPicker } from "../ModelPicker"

type NineRouterProps = {
	apiConfiguration: ProviderSettings
	setApiConfigurationField: (field: keyof ProviderSettings, value: ProviderSettings[keyof ProviderSettings]) => void
	organizationAllowList: OrganizationAllowList
	modelValidationError?: string
}

export const NineRouter = ({
	apiConfiguration,
	setApiConfigurationField,
	organizationAllowList,
	modelValidationError,
}: NineRouterProps) => {
	const { t } = useAppTranslation()
	const { routerModels } = useExtensionState()
	const [refreshStatus, setRefreshStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
	const [refreshError, setRefreshError] = useState<string | undefined>()
	const nineRouterErrorJustReceived = useRef(false)

	useEffect(() => {
		const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data
			if (message.type === "singleRouterModelFetchResponse" && !message.success) {
				const providerName = message.values?.provider as RouterName
				if (providerName === "9router") {
					nineRouterErrorJustReceived.current = true
					setRefreshStatus("error")
					setRefreshError(message.error)
				}
			} else if (message.type === "routerModels") {
				if (refreshStatus === "loading") {
					if (!nineRouterErrorJustReceived.current) {
						setRefreshStatus("success")
					}
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [refreshStatus, refreshError, setRefreshStatus, setRefreshError])

	const handleInputChange = useCallback(
		<K extends keyof ProviderSettings, E>(
			field: K,
			transform: (event: E) => ProviderSettings[K] = inputEventTransform,
		) =>
			(event: E | Event) => {
				setApiConfigurationField(field, transform(event as E))
			},
		[setApiConfigurationField],
	)

	const handleRefreshModels = useCallback(() => {
		nineRouterErrorJustReceived.current = false
		setRefreshStatus("loading")
		setRefreshError(undefined)

		const key = apiConfiguration.nineRouterApiKey
		const url = apiConfiguration.nineRouterBaseUrl || "http://localhost:20128/v1"

		vscode.postMessage({ type: "flushRouterModels", text: "9router" })
		vscode.postMessage({ type: "requestRouterModels", values: { nineRouterApiKey: key, nineRouterBaseUrl: url } })
	}, [apiConfiguration, setRefreshStatus, setRefreshError])

	const availableModels = routerModels?.["9router"] ?? {}
	const hasFetchedModels = Object.keys(availableModels).length > 0

	return (
		<>
			<VSCodeTextField
				value={apiConfiguration?.nineRouterBaseUrl || ""}
				onInput={handleInputChange("nineRouterBaseUrl")}
				placeholder="http://localhost:20128/v1"
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.nineRouterBaseUrl")}</label>
			</VSCodeTextField>

			<VSCodeTextField
				value={apiConfiguration?.nineRouterApiKey || ""}
				type="password"
				onInput={handleInputChange("nineRouterApiKey")}
				placeholder={t("settings:placeholders.apiKey")}
				className="w-full">
				<label className="block font-medium mb-1">{t("settings:providers.nineRouterApiKey")}</label>
			</VSCodeTextField>

			<div className="text-sm text-vscode-descriptionForeground -mt-2">
				{t("settings:providers.apiKeyStorageNotice")}
			</div>

			<Button
				variant="outline"
				onClick={handleRefreshModels}
				disabled={refreshStatus === "loading"}
				className="w-full">
				<div className="flex items-center gap-2">
					{refreshStatus === "loading" ? (
						<span className="codicon codicon-loading codicon-modifier-spin" />
					) : (
						<span className="codicon codicon-refresh" />
					)}
					{t("settings:providers.refreshModels.label")}
				</div>
			</Button>

			{refreshStatus === "loading" && (
				<div className="text-sm text-vscode-descriptionForeground">
					{t("settings:providers.refreshModels.loading")}
				</div>
			)}
			{refreshStatus === "success" && (
				<div className="text-sm text-vscode-foreground">{t("settings:providers.refreshModels.success")}</div>
			)}
			{refreshStatus === "error" && (
				<div className="text-sm text-vscode-errorForeground">
					{refreshError || t("settings:providers.refreshModels.error")}
				</div>
			)}

			{hasFetchedModels ? (
				<ModelPicker
					apiConfiguration={apiConfiguration}
					defaultModelId={nineRouterDefaultModelId}
					models={availableModels}
					modelIdKey="nineRouterModelId"
					serviceName="9Router"
					serviceUrl="https://github.com/9router/9router"
					setApiConfigurationField={setApiConfigurationField}
					organizationAllowList={organizationAllowList}
					errorMessage={modelValidationError}
				/>
			) : (
				<VSCodeTextField
					value={apiConfiguration?.nineRouterModelId || ""}
					onInput={handleInputChange("nineRouterModelId")}
					placeholder="claude-3-7-sonnet"
					className="w-full">
					<label className="block font-medium mb-1">{t("settings:providers.nineRouterModelId")}</label>
				</VSCodeTextField>
			)}

			<VSCodeButtonLink href="https://github.com/9router/9router" appearance="secondary">
				{t("settings:providers.getNineRouterInfo")}
			</VSCodeButtonLink>
		</>
	)
}
