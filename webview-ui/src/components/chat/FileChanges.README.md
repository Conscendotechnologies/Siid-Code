# FileChanges Component

A reusable React component for displaying file changes with two variants: a collapsible list view and a detailed expanded view. Includes diff tracking, deployment status tracking, and localStorage persistence.

## Features

- **Two Variants**: List (collapsible) and Detail (always expanded with prominent stats)
- **File Statistics**: Shows additions (+) and deletions (-) when available
- **Status Icons**: Visual indicators for created, modified, and deleted files
- **Deployment Status**: Track and display file deployment stages (local, dry-run, deploying, deployed, failed)
- **Diff Tracking**: Store and view actual file diffs
- **LocalStorage Persistence**: Automatically persists file changes for each task
- **Clickable Files**: Opens files in VS Code editor
- **Diff Viewer**: Modal view to inspect changes
- **Responsive Design**: Works with VS Code theming
- **TypeScript Support**: Fully typed with exported interfaces

## Installation

The component is already integrated into the chat interface. Import it where needed:

```typescript
import { FileChanges, type FileChange, type DeploymentStatus } from "./components/chat/FileChanges"
import { DiffViewer } from "./components/chat/DiffViewer"
```

## Usage

### Basic List Variant with Deployment Status

```tsx
const [selectedDiffFile, setSelectedDiffFile] = useState<FileChange | null>(null)

<FileChanges
  files={fileChanges}
  variant="list"
  defaultCollapsed={true}
  onViewDiff={(file) => setSelectedDiffFile(file)}
  taskId={task?.ts}
/>

{selectedDiffFile && (
  <DiffViewer
    file={selectedDiffFile}
    onClose={() => setSelectedDiffFile(null)}
  />
)}
```

### Detail Variant with Full Statistics

```tsx
<FileChanges files={fileChanges} variant="detail" onViewDiff={(file) => setSelectedDiffFile(file)} taskId={task?.ts} />
```

### With Custom File Click Handler

```tsx
<FileChanges
	files={fileChanges}
	variant="list"
	onFileClick={(path) => {
		console.log("Opening:", path)
		// Custom logic here
	}}
	onViewDiff={(file) => showDiff(file)}
	taskId="my-task-id"
/>
```

## Props

### FileChangesProps

| Prop               | Type                         | Default    | Description                                 |
| ------------------ | ---------------------------- | ---------- | ------------------------------------------- |
| `files`            | `FileChange[]`               | _required_ | Array of file changes to display            |
| `variant`          | `"list" \| "detail"`         | `"list"`   | Display variant                             |
| `defaultCollapsed` | `boolean`                    | `true`     | Initial collapsed state (list variant only) |
| `onFileClick`      | `(path: string) => void`     | _optional_ | Custom file click handler                   |
| `onViewDiff`       | `(file: FileChange) => void` | _optional_ | Handler for viewing diffs                   |
| `className`        | `string`                     | `""`       | Additional CSS classes                      |
| `taskId`           | `string`                     | _optional_ | Task ID for localStorage persistence        |

### FileChange Type

```typescript
type FileChange = {
	path: string // File path (required)
	additions?: number // Lines added
	deletions?: number // Lines deleted
	status?: "modified" | "created" | "deleted" // File status
	diff?: string // Actual diff content
	deploymentStatus?: DeploymentStatus // Deployment stage
	timestamp?: number // When the change was made
	error?: string // Error message if deployment failed
}

type DeploymentStatus = "local" | "dry-run" | "deploying" | "deployed" | "failed"
```

### DiffViewerProps

| Prop      | Type         | Description                       |
| --------- | ------------ | --------------------------------- |
| `file`    | `FileChange` | File with diff to display         |
| `onClose` | `() => void` | Callback to close the diff viewer |

## Variants

### List Variant

- **Use Case**: Compact display in chat interface
- **Behavior**: Collapsible with chevron icon
- **Features**:
    - Shows file count in header
    - Expandable/collapsible
    - Hover background for better visibility
    - Scrollable if content exceeds max height

### Detail Variant

- **Use Case**: Summary views, reports, PR descriptions
- **Behavior**: Always expanded with prominent statistics
- **Features**:
    - Border container for visual separation
    - Total additions/deletions summary in header
    - Status icons with appropriate colors
    - More spacious layout

## Status Icons and Colors

| Status     | Icon                    | Color                                             |
| ---------- | ----------------------- | ------------------------------------------------- |
| `created`  | `codicon-diff-added`    | Green (gitDecoration-addedResourceForeground)     |
| `modified` | `codicon-diff-modified` | Orange (gitDecoration-modifiedResourceForeground) |
| `deleted`  | `codicon-diff-removed`  | Red (gitDecoration-deletedResourceForeground)     |
| _default_  | `codicon-file`          | Default foreground                                |

## Deployment Status Badges

| Status      | Label     | Icon                | Color             |
| ----------- | --------- | ------------------- | ----------------- |
| `local`     | Local     | `codicon-file`      | Blue              |
| `dry-run`   | Dry Run   | `codicon-debug-alt` | Purple            |
| `deploying` | Deploying | `codicon-sync~spin` | Orange (animated) |
| `deployed`  | Deployed  | `codicon-check`     | Green             |
| `failed`    | Failed    | `codicon-error`     | Red               |

## Examples

See [`FileChanges.example.tsx`](./FileChanges.example.tsx) for comprehensive usage examples.

## Integration with ChatView

The FileChanges component is integrated into ChatView.tsx and automatically displays tracked file changes with diff and deployment tracking:

```tsx
{
	fileChanges.length > 0 && (
		<FileChanges
			files={fileChanges}
			variant="list"
			defaultCollapsed={fileListCollapsed}
			onViewDiff={(file) => setSelectedDiffFile(file)}
			className="px-3.5 mb-2"
			taskId={task?.ts ? String(task.ts) : undefined}
		/>
	)
}
{
	selectedDiffFile && <DiffViewer file={selectedDiffFile} onClose={() => setSelectedDiffFile(null)} />
}
```

## LocalStorage Utilities

The component includes utility functions for persisting file changes:

```typescript
// Save file changes for a task
saveFileChanges(taskId: string, files: FileChange[]): void

// Load file changes for a task
loadFileChanges(taskId: string): FileChange[]

// Clear file changes for a task
clearFileChanges(taskId: string): void
```

**Storage Key Format**: `fileChanges_{taskId}`

### Example Usage:

```typescript
import { saveFileChanges, loadFileChanges } from "./FileChanges"

// Save changes
saveFileChanges("task-123", fileChanges)

// Load changes
const savedChanges = loadFileChanges("task-123")

// Clear when task is complete
clearFileChanges("task-123")
```

## File Change Detection

File changes are automatically detected through multiple mechanisms:

1. **Message Parsing**: Scans messages for "Created:", "Modified:", etc.
2. **Extension Events**: Listens for file creation and task completion events
3. **DOM Fallback**: Scans rendered content as a backup

### Setting Deployment Status

When receiving file changes from the extension, include the deployment status:

```typescript
// From extension
vscode.postMessage({
	type: "fileCreated",
	files: [
		{
			path: "src/App.tsx",
			additions: 10,
			deletions: 2,
			status: "modified",
			diff: "...", // actual diff string
			deploymentStatus: "dry-run", // or "local", "deploying", "deployed", "failed"
			timestamp: Date.now(),
			error: undefined, // set if deployment failed
		},
	],
})
```

### Updating Deployment Status

To update the deployment status of files (e.g., after deployment):

```typescript
setFileChanges((prev) =>
	prev.map((file) => (file.path === targetPath ? { ...file, deploymentStatus: "deployed" } : file)),
)
```

## Styling

The component uses VS Code CSS variables for theming:

- `--vscode-editor-foreground`
- `--vscode-editorHoverWidget-background`
- `--vscode-panel-border`
- `--vscode-charts-green`
- `--vscode-errorForeground`
- `--vscode-gitDecoration-*`

## Accessibility

- Keyboard navigable buttons
- Screen reader friendly
- Semantic HTML structure

## Future Enhancements

Potential improvements for future versions:

- [x] Diff preview in modal
- [x] Deployment status tracking
- [x] LocalStorage persistence
- [ ] Bulk file operations (open all, compare, etc.)
- [ ] Filtering by status or deployment stage
- [ ] Sorting options (by name, status, timestamp)
- [ ] Copy file paths
- [ ] Export file list
- [ ] Integration with git status
- [ ] Side-by-side diff view
- [ ] Inline diff annotations
- [ ] Real-time deployment progress
- [ ] Rollback functionality

## License

Part of the Roo-Code/Siid-Code project.
