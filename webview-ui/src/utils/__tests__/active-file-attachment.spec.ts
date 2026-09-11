import { convertToMentionPath } from "../path-mentions"

/**
 * The attachment chip prepends the active editor as an @mention so the existing
 * server-side mention parser resolves its contents. This covers that composition
 * rule, which lives inline in ChatView.handleSendMessage.
 */
const withAttachment = (text: string, mention?: string) => {
	if (mention && !text.includes(mention)) {
		return text ? `${mention} ${text}` : mention
	}
	return text
}

describe("active file attachment", () => {
	const cwd = "/home/user/project"

	it("converts an absolute path inside cwd to a relative mention", () => {
		expect(convertToMentionPath("/home/user/project/src/a.ts", cwd)).toBe("@/src/a.ts")
	})

	it("prepends the mention to the message", () => {
		const mention = convertToMentionPath("/home/user/project/src/a.ts", cwd)
		expect(withAttachment("fix this", mention)).toBe("@/src/a.ts fix this")
	})

	it("sends the mention alone when there is no text", () => {
		expect(withAttachment("", "@/src/a.ts")).toBe("@/src/a.ts")
	})

	it("does not duplicate a mention the user already typed", () => {
		expect(withAttachment("look at @/src/a.ts please", "@/src/a.ts")).toBe("look at @/src/a.ts please")
	})

	it("leaves the message untouched when nothing is attached", () => {
		expect(withAttachment("hello", undefined)).toBe("hello")
	})

	it("escapes spaces so the mention regex captures the whole path", () => {
		expect(convertToMentionPath("/home/user/project/my file.ts", cwd)).toBe("@/my\\ file.ts")
	})

	describe("line ranges", () => {
		const withRange = (path: string, selection?: { startLine: number; endLine: number }) => {
			const base = convertToMentionPath(path, cwd)
			return selection ? `${base}:${selection.startLine}-${selection.endLine}` : base
		}

		it("appends the selected range to the mention", () => {
			expect(withRange("/home/user/project/src/a.ts", { startLine: 22, endLine: 29 })).toBe("@/src/a.ts:22-29")
		})

		it("omits the range when nothing is selected", () => {
			expect(withRange("/home/user/project/src/a.ts")).toBe("@/src/a.ts")
		})

		it("keeps a single-line selection as an explicit range", () => {
			expect(withRange("/home/user/project/src/a.ts", { startLine: 7, endLine: 7 })).toBe("@/src/a.ts:7-7")
		})

		it("prepends a ranged mention to the message", () => {
			expect(withAttachment("explain", "@/src/a.ts:22-29")).toBe("@/src/a.ts:22-29 explain")
		})
	})
})
