// ...existing code...
import RooHero from "./RooHero"
import { Tab, TabContent } from "../common/Tab"

type CannotLoginProps = {
	hackDate?: string
}

const CannotLoginView = ({ hackDate }: CannotLoginProps) => {
	const hackDateString = hackDate ? new Date(hackDate).toLocaleDateString() : "unknown date"

	return (
		<Tab>
			<TabContent className="flex flex-col gap-5 p-16">
				<RooHero />
				<h2 className="mt-0 mb-0">Thank you for using SIID</h2>

				<div className="font-bold">
					<p>Hackathon completed - Your access has expired.</p>
				</div>

				<div className="bg-vscode-editorError-background border border-vscode-errorForeground rounded-md p-4">
					<p className="text-vscode-errorForeground">
						Your access period has expired. The 2-day window from {hackDateString} has passed.
					</p>
				</div>

				<div className="text-sm text-vscode-descriptionForeground">
					<h3 className="font-semibold mb-2">What happened?</h3>
					<p>
						This application has a limited access period. The 2-day window from your initial access date has
						expired.
					</p>
				</div>
			</TabContent>
		</Tab>
	)
}

export default CannotLoginView
