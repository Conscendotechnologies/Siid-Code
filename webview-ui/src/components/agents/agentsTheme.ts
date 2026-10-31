import type { CSSProperties } from "react"

/**
 * Hardcoded Conscendo light palette for the Agents screen. Applied as scoped CSS variables on the
 * Agents root so the screen stays white whatever the editor theme is. Each VS Code token
 * is written twice: the raw --vscode-* variable (used by inline styles and codicon rules)
 * and the Tailwind --color-vscode-* alias, which is resolved at :root and therefore has
 * to be overridden explicitly on the scoped element.
 */
const vscodeTokens: Record<string, string> = {
	foreground: "#171717",
	"editor-foreground": "#171717",
	"editor-background": "#ffffff",
	"editorGroup-border": "#E6E6E6",
	"editorWarning-foreground": "#b7791f",
	"editorWarning-background": "#fff7e0",
	"button-foreground": "#ffffff",
	"button-background": "#5A2483",
	"button-hoverBackground": "#4E1F73",
	"button-secondaryForeground": "#171717",
	"button-secondaryBackground": "#F2F2F2",
	"dropdown-foreground": "#171717",
	"dropdown-background": "#ffffff",
	"dropdown-border": "#E6E6E6",
	"input-foreground": "#171717",
	"input-background": "#ffffff",
	"input-border": "#E6E6E6",
	"input-placeholderForeground": "#9A9A9A",
	focusBorder: "#5A2483",
	"badge-foreground": "#ffffff",
	"badge-background": "#5A2483",
	"notifications-foreground": "#171717",
	"notifications-background": "#ffffff",
	"notifications-border": "#E6E6E6",
	descriptionForeground: "#3A3A3A",
	disabledForeground: "#9A9A9A",
	errorForeground: "#d92d20",
	"list-hoverForeground": "#171717",
	"list-hoverBackground": "#F2F2F2",
	"list-focusBackground": "#EEE8F3",
	"list-activeSelectionBackground": "#EEE8F3",
	"list-activeSelectionForeground": "#171717",
	"toolbar-hoverBackground": "#F2F2F2",
	"panel-border": "#E6E6E6",
	"sideBar-foreground": "#171717",
	"sideBar-background": "#FFFFFF",
	"sideBar-border": "#E6E6E6",
	"sideBarSectionHeader-foreground": "#171717",
	"sideBarSectionHeader-background": "#F2F2F2",
	"sideBarSectionHeader-border": "#E6E6E6",
	"titleBar-activeForeground": "#171717",
	"titleBar-inactiveForeground": "#3A3A3A",
	"charts-green": "#1a7f37",
	"charts-yellow": "#b7791f",
	"inputValidation-infoForeground": "#171717",
	"inputValidation-infoBackground": "#EEE8F3",
	"inputValidation-infoBorder": "#5A2483",
	"widget-border": "#E6E6E6",
	"textLink-foreground": "#5A2483",
	"textLink-activeForeground": "#4E1F73",
	"textCodeBlock-background": "#F2F2F2",
	"textPreformat-foreground": "#171717",
	"textBlockQuote-background": "#F2F2F2",
	"textBlockQuote-border": "#E6E6E6",
	"menu-background": "#ffffff",
	"menu-foreground": "#171717",
	"editorWidget-background": "#ffffff",
	"editor-selectionBackground": "#EEE8F3",
	"editor-inactiveSelectionBackground": "#EEE8F3",
	"scrollbarSlider-background": "rgba(100,110,130,0.25)",
	"scrollbarSlider-hoverBackground": "rgba(100,110,130,0.4)",
	"scrollbarSlider-activeBackground": "rgba(100,110,130,0.55)",
}

const shadcnTokens: Record<string, string> = {
	"--background": "#ffffff",
	"--foreground": "#171717",
	"--card": "#ffffff",
	"--card-foreground": "#171717",
	"--popover": "#ffffff",
	"--popover-foreground": "#171717",
	"--primary": "#5A2483",
	"--primary-foreground": "#ffffff",
	"--secondary": "#F2F2F2",
	"--secondary-foreground": "#171717",
	"--muted": "#9A9A9A",
	"--muted-foreground": "#3A3A3A",
	"--accent": "#F2F2F2",
	"--accent-foreground": "#171717",
	"--destructive": "#d92d20",
	"--destructive-foreground": "#ffffff",
	"--border": "#E6E6E6",
	"--input": "#ffffff",
	"--ring": "#5A2483",
}

export const agentsThemeVars: CSSProperties = (() => {
	const vars: Record<string, string> = { colorScheme: "light" }
	for (const [name, value] of Object.entries(vscodeTokens)) {
		vars[`--vscode-${name}`] = value
		vars[`--color-vscode-${name}`] = value
	}
	for (const [name, value] of Object.entries(shadcnTokens)) {
		vars[name] = value
	}
	return vars as CSSProperties
})()
