// ...existing code...
import RooHero from "./RooHero"
import { Tab, TabContent } from "../common/Tab"

type CannotLoginProps = {
	hackDate?: string
}

const CannotLoginView = ({ hackDate }: CannotLoginProps) => {
	const completionDate = hackDate ? new Date(hackDate).toLocaleDateString() : undefined

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5 p-16">
				<RooHero />
				<h2 className="mt-0 mb-0">Thank you for using SIID</h2>

				<div className="font-bold text-base">
					<p>Hackathon has been completed.</p>
				</div>

				<div className="bg-vscode-editor-background border border-vscode-panel-border rounded-md p-4">
					<p className="mb-2">Limited access completed. Thank you for participating.</p>
					{completionDate && (
						<p className="text-sm text-vscode-descriptionForeground">
							Access period started on {completionDate}.
						</p>
					)}
				</div>

				<div className="text-sm text-vscode-descriptionForeground">
					<p>
						We appreciate your time during the event. This workspace is now closed for login as the
						hackathon period has ended.
					</p>
				</div>
			</TabContent>
		</Tab>
	)
}

export default CannotLoginView
