# Tool Architecture - SIID Code

This document provides a comprehensive overview of the tool architecture in SIID Code, explaining how AI-powered development tools are structured, registered, and executed.

## Overview

The tool architecture follows a **dual-layer pattern**:

1. **Prompt Layer** (`src/core/prompts/tools/`) - Defines tool descriptions for the LLM
2. **Execution Layer** (`src/core/tools/`) - Implements the actual tool logic

## Architecture Components

### 1. Tool Type System

**Location:** [packages/types/src/tool.ts](packages/types/src/tool.ts)

#### Tool Groups

Tools are organized into logical groups:

- `read` - File reading and search operations
- `edit` - File editing and modification operations
- `browser` - Browser automation
- `command` - Command execution
- `mcp` - Model Context Protocol integration
- `modes` - Mode switching and task management

#### Available Tools (19 Total)

```typescript
;[
	"execute_command",
	"read_file",
	"write_to_file",
	"apply_diff",
	"insert_content",
	"search_and_replace",
	"search_files",
	"list_files",
	"list_code_definition_names",
	"browser_action",
	"use_mcp_tool",
	"access_mcp_resource",
	"ask_followup_question",
	"attempt_completion",
	"switch_mode",
	"new_task",
	"fetch_instructions",
	"codebase_search",
	"update_todo_list",
	"retrieve_sf_metadata",
]
```

### 2. Prompt Layer

**Location:** [src/core/prompts/tools/](src/core/prompts/tools/)

Each tool has a description function that generates the prompt text sent to the LLM.

#### Pattern

```typescript
// Example: src/core/prompts/tools/read-file.ts
export function getReadFileDescription(args: ToolArgs): string {
	return `## read_file
Description: Request to read the contents of files...
Parameters:
- path: (required) File path
- line_range: (optional) Line ranges
Usage:
<read_file>
<args>...</args>
</read_file>`
}
```

#### Key Files

- [index.ts](src/core/prompts/tools/index.ts) - Central registry mapping tool names to description functions
- [types.ts](src/core/prompts/tools/types.ts) - Common type definitions for tool arguments
- Individual tool description files:
    - [read-file.ts](src/core/prompts/tools/read-file.ts)
    - [write-to-file.ts](src/core/prompts/tools/write-to-file.ts)
    - [execute-command.ts](src/core/prompts/tools/execute-command.ts)
    - [search-and-replace.ts](src/core/prompts/tools/search-and-replace.ts)
    - And more...

### 3. Execution Layer

**Location:** [src/core/tools/](src/core/tools/)

Each tool has an execution function that performs the actual operation.

#### Pattern

All tool implementations follow this signature:

```typescript
export async function toolNameTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	// Tool implementation
}
```

#### Common Parameters

- `cline: Task` - The current task context with state and configuration
- `block: ToolUse` - The parsed tool use block containing parameters
- `askApproval: AskApproval` - Function to request user approval before execution
- `handleError: HandleError` - Error handling callback
- `pushToolResult: PushToolResult` - Function to push results back to the LLM
- `removeClosingTag: RemoveClosingTag` - XML tag cleanup utility

#### Key Implementation Files

- [readFileTool.ts](src/core/tools/readFileTool.ts) - File reading with support for images, PDFs, DOCX
- [writeToFileTool.ts](src/core/tools/writeToFileTool.ts) - File writing with validation and protection checks
- [executeCommandTool.ts](src/core/tools/executeCommandTool.ts) - Terminal command execution with shell integration
- [applyDiffTool.ts](src/core/tools/applyDiffTool.ts) - Code diff application with fuzzy matching
- [insertContentTool.ts](src/core/tools/insertContentTool.ts) - Content insertion at specific lines
- [searchAndReplaceTool.ts](src/core/tools/searchAndReplaceTool.ts) - Find and replace operations
- [codebaseSearchTool.ts](src/core/tools/codebaseSearchTool.ts) - Semantic code search
- [browserActionTool.ts](src/core/tools/browserActionTool.ts) - Browser automation via Puppeteer
- [updateTodoListTool.ts](src/core/tools/updateTodoListTool.ts) - Task management and tracking
- [useMcpToolTool.ts](src/core/tools/useMcpToolTool.ts) - MCP tool integration

### 4. Tool Execution Dispatcher

**Location:** [src/core/assistant-message/presentAssistantMessage.ts](src/core/assistant-message/presentAssistantMessage.ts)

The central switch statement routes tool calls to their implementations:

```typescript
switch (block.name) {
	case "read_file":
		await readFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
		break

	case "write_to_file":
		await writeToFileTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
		break

	case "execute_command":
		await executeCommandTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
		break

	case "apply_diff":
		// Special handling for diff strategies
		await applyDiffTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
		break

	// ... more cases for all 19 tools
}
```

### 5. Supporting Infrastructure

#### Tool Configuration

**Location:** [src/shared/tools.ts](src/shared/tools.ts)

Contains:

- Tool groups and their members
- Tool display names for UI
- Always-available tools list
- Tool parameter definitions
- Diff strategy interfaces

```typescript
export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
	read: {
		tools: [
			"read_file",
			"fetch_instructions",
			"search_files",
			"list_files",
			"list_code_definition_names",
			"codebase_search",
			"retrieve_sf_metadata",
		],
	},
	edit: {
		tools: ["apply_diff", "write_to_file", "insert_content", "search_and_replace"],
	},
	// ... more groups
}
```

#### Tool Validation

Each tool performs validation:

- Parameter validation (required fields, types)
- Permission checks via `RooIgnoreController`
- Write protection checks via `RooProtectedController`
- Path safety validation

#### Tool Repetition Detection

**Location:** [src/core/tools/ToolRepetitionDetector.ts](src/core/tools/ToolRepetitionDetector.ts)

Detects when tools are being called repeatedly without progress and alerts the LLM to try a different approach.

## Adding a New Tool

To add a new tool to the system, follow these steps:

### 1. Define Tool Type

Add the tool name to `toolNames` in [packages/types/src/tool.ts](packages/types/src/tool.ts):

```typescript
export const toolNames = [
	// ... existing tools
	"your_new_tool",
] as const
```

### 2. Create Prompt Description

Create `src/core/prompts/tools/your-new-tool.ts`:

```typescript
import { ToolArgs } from "./types"

export function getYourNewToolDescription(args: ToolArgs): string {
	return `## your_new_tool
Description: What your tool does...
Parameters:
- param1: (required) Description
- param2: (optional) Description
Usage:
<your_new_tool>
<param1>Value</param1>
<param2>Value</param2>
</your_new_tool>

Example:
<your_new_tool>
<param1>example</param1>
</your_new_tool>`
}
```

### 3. Register Description

Add to the registry in [src/core/prompts/tools/index.ts](src/core/prompts/tools/index.ts):

```typescript
import { getYourNewToolDescription } from "./your-new-tool"

const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
	// ... existing tools
	your_new_tool: (args) => getYourNewToolDescription(args),
}

// Also export it
export {
	// ... existing exports
	getYourNewToolDescription,
}
```

### 4. Create Implementation

Create `src/core/tools/yourNewToolTool.ts`:

```typescript
import { Task } from "../task/Task"
import { ToolUse, AskApproval, HandleError, PushToolResult, RemoveClosingTag } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"

export async function yourNewToolTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	// 1. Extract and validate parameters
	const param1: string | undefined = block.params.param1
	const param2: string | undefined = block.params.param2

	// 2. Handle partial message (streaming)
	if (block.partial) {
		// Show partial state to user
		return
	}

	// 3. Validate required parameters
	if (!param1) {
		cline.consecutiveMistakeCount++
		pushToolResult(await cline.sayAndCreateMissingParamError("your_new_tool", "param1"))
		return
	}

	// 4. Request user approval
	const didApprove = await askApproval("your_ask_type", param1)
	if (!didApprove) {
		return
	}

	try {
		// 5. Execute tool logic
		const result = await performOperation(param1, param2)

		// 6. Push result back
		pushToolResult(formatResponse.toolResult(result))
	} catch (error) {
		// 7. Handle errors
		await handleError("performing operation", error)
	}
}
```

### 5. Add to Dispatcher

Add a case in [src/core/assistant-message/presentAssistantMessage.ts](src/core/assistant-message/presentAssistantMessage.ts):

```typescript
case "your_new_tool":
  await yourNewToolTool(cline, block, askApproval, handleError, pushToolResult, removeClosingTag)
  break
```

### 6. Add to Tool Group

Update [src/shared/tools.ts](src/shared/tools.ts):

```typescript
// Add to appropriate tool group
export const TOOL_GROUPS: Record<ToolGroup, ToolGroupConfig> = {
	read: {
		tools: [
			// ... existing tools
			"your_new_tool", // if it's a read tool
		],
	},
	// ... other groups
}

// Add display name
export const TOOL_DISPLAY_NAMES: Record<ToolName, string> = {
	// ... existing tools
	your_new_tool: "your tool display name",
}
```

### 7. Add Parameter Names (if needed)

If your tool uses new parameter names, add them to [src/shared/tools.ts](src/shared/tools.ts):

```typescript
export const toolParamNames = [
	// ... existing params
	"your_param_name",
] as const
```

### 8. Add Tool Interface (optional)

For type safety, add an interface in [src/shared/tools.ts](src/shared/tools.ts):

```typescript
export interface YourNewToolToolUse extends ToolUse {
	name: "your_new_tool"
	params: Partial<Pick<Record<ToolParamName, string>, "param1" | "param2">>
}
```

## Key Design Principles

1. **Separation of Concerns:** Prompt definitions are separate from execution logic, making it easy to update descriptions without touching implementation

2. **Consistent Interface:** All tools follow the same execution signature, making the system predictable and maintainable

3. **Approval Flow:** Built-in user approval mechanism for operations that modify files or execute commands

4. **Error Handling:** Standardized error handling via callbacks ensures consistent error reporting

5. **Context Tracking:** File context tracking helps the LLM understand what files it has accessed

6. **Mode-Based Access:** Tools are grouped and enabled based on operational mode (code, architect, ask, etc.)

7. **Extensibility:** Easy to add new tools by following established patterns

8. **Safety First:** Multiple layers of validation, approval, and protection mechanisms

## Special Tool Features

### File Operations

- **Format Support:** Images (PNG, JPG, etc.), PDFs, DOCX, and text files
- **Line Numbers:** Output includes line numbers for precise code references
- **Partial Reading:** Read specific line ranges from large files
- **Batch Operations:** Read multiple files in a single call
- **Protection:** Respects `.rooignore` and write-protected files

### Command Execution

- **Shell Integration:** Leverages VS Code's shell integration API
- **Timeout Management:** Configurable timeouts with allowlist for long-running commands
- **Output Limiting:** Configurable limits on output lines and characters
- **Terminal Management:** Reuses terminals and manages terminal lifecycle

### Code Editing

- **Multiple Strategies:** Support for different diff strategies (search-replace, unified diff)
- **Fuzzy Matching:** Finds similar code blocks even with whitespace differences
- **Omission Detection:** Prevents accidental code truncation
- **Checkpoint System:** Save points for rollback if edits fail
- **Multi-file Edits:** Apply changes across multiple files in one operation

### Browser Automation

- **Puppeteer Integration:** Full browser automation capabilities
- **Computer Use:** Supports Anthropic's computer use feature
- **Screenshot Support:** Can capture and analyze webpage screenshots

### MCP (Model Context Protocol)

- **Server Management:** Connect to and manage MCP servers
- **Tool Access:** Use tools provided by MCP servers
- **Resource Access:** Access resources exposed by MCP servers

## Testing

Each tool should have corresponding tests in:

- `src/core/tools/__tests__/` - Unit tests for tool implementations
- `apps/vscode-e2e/src/suite/tools/` - End-to-end integration tests

Example test structure:

```typescript
describe("yourNewToolTool", () => {
	it("should validate required parameters", async () => {
		// Test parameter validation
	})

	it("should request approval before execution", async () => {
		// Test approval flow
	})

	it("should handle errors gracefully", async () => {
		// Test error handling
	})
})
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         LLM (Claude)                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                    Tool Use Request
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│            presentAssistantMessage (Dispatcher)              │
│                     Switch Statement                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
    ┌────────────────────┐   ┌────────────────────┐
    │  Prompt Layer      │   │  Execution Layer   │
    │  (Descriptions)    │   │  (Implementation)  │
    └────────────────────┘   └──────────┬─────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
            ┌──────────────┐    ┌──────────────┐   ┌──────────────┐
            │ File System  │    │   Terminal   │   │   Browser    │
            └──────────────┘    └──────────────┘   └──────────────┘
```

## Additional Resources

- [Tool Use Guidelines](src/core/prompts/sections/tool-use-guidelines.ts) - Prompt instructions for effective tool usage
- [Tool Validation](src/core/tools/validateToolUse.ts) - Tool use validation logic
- [Modes Documentation](src/shared/modes.ts) - Understanding different operational modes
- [Response Formatting](src/core/prompts/responses.ts) - Standard response formats

## Contributing

When contributing new tools:

1. Follow the established patterns and conventions
2. Include comprehensive documentation in the prompt description
3. Add proper error handling and validation
4. Include tests for both happy path and error cases
5. Update this documentation with any new patterns or features
6. Consider security implications and add appropriate safeguards
