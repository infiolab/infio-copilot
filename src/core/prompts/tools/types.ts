import { FileSearchSettings } from "../../../types/settings"
import { DiffStrategy } from "../../diff/DiffStrategy"
import { McpHub } from "../../mcp/McpHub"

export type ToolArgs = {
	cwd: string
	searchSettings: FileSearchSettings,
	searchTool?: string,
	supportsComputerUse: boolean
	diffStrategy?: DiffStrategy
	browserViewportSize?: string
	mcpHub?: McpHub
	toolOptions?: any
}
