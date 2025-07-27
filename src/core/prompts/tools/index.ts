import { FilesSearchSettings } from "../../../types/settings"
import { Mode, ModeConfig, getGroupName, getModeConfig, isToolAllowedForMode } from "../../../utils/modes"
import { DiffStrategy } from "../../diff/DiffStrategy"
import { McpHub } from "../../mcp/McpHub"

import { getAccessMcpResourceDescription } from "./access-mcp-resource"
import { getAskFollowupQuestionDescription } from "./ask-followup-question"
import { getAttemptCompletionDescription } from "./attempt-completion"
import { getCallInsightsDescription } from "./call-insights"
import { getDataviewQueryDescription } from "./dataview-query"
import { getFetchUrlsContentDescription } from "./fetch-url-content"
import { getInsertContentDescription } from "./insert-content"
import { getListFilesDescription } from "./list-files"
import { getManageFilesDescription } from "./manage-files"
import { getReadFileDescription } from "./read-file"
import { getSearchAndReplaceDescription } from "./search-and-replace"
import { getSearchFilesDescription } from "./search-files"
import { getSearchWebDescription } from "./search-web"
import { getSwitchModeDescription } from "./switch-mode"
import { ALWAYS_AVAILABLE_TOOLS, TOOL_GROUPS } from "./tool-groups"
import { ToolArgs } from "./types"
import { getUseMcpToolDescription } from "./use-mcp-tool"
import { getWriteToFileDescription } from "./write-to-file"

// Map of tool names to their description functions
const toolDescriptionMap: Record<string, (args: ToolArgs) => string | undefined> = {
	read_file: (args) => getReadFileDescription(args),
	write_to_file: (args) => getWriteToFileDescription(args),
	search_files: (args) => getSearchFilesDescription(args),
	list_files: (args) => getListFilesDescription(args),
	insights: (args) => getCallInsightsDescription(args),
	dataview_query: (args) => getDataviewQueryDescription(args),
	ask_followup_question: () => getAskFollowupQuestionDescription(),
	attempt_completion: () => getAttemptCompletionDescription(),
	switch_mode: () => getSwitchModeDescription(),
	insert_content: (args) => getInsertContentDescription(args),
	use_mcp_tool: (args) => getUseMcpToolDescription(args),
	access_mcp_resource: (args) => getAccessMcpResourceDescription(args),
	search_and_replace: (args) => getSearchAndReplaceDescription(args),
	manage_files: (args) => getManageFilesDescription(args),
	apply_diff: (args) =>
		args.diffStrategy ? args.diffStrategy.getToolDescription({ cwd: args.cwd, toolOptions: args.toolOptions }) : "",
	search_web: (args): string | undefined => getSearchWebDescription(args),
	fetch_urls_content: (args): string | undefined => getFetchUrlsContentDescription(args),
}

export function getToolDescriptionsForMode(
	mode: Mode,
	cwd: string,
	searchSettings: FilesSearchSettings,
	searchTool: string,
	supportsComputerUse: boolean,
	diffStrategy?: DiffStrategy,
	browserViewportSize?: string,
	mcpHub?: McpHub,
	customModes?: ModeConfig[],
	experiments?: Record<string, boolean>,
): string {
	const config = getModeConfig(mode, customModes)
	const args: ToolArgs = {
		cwd,
		searchSettings,
		searchTool,
		supportsComputerUse,
		diffStrategy,
		browserViewportSize,
		mcpHub,
	}

	const tools = new Set<string>()

	// Add tools from mode's tools list directly
	config.tools.forEach((tool) => {
		if (isToolAllowedForMode(tool, mode, customModes ?? [], experiments ?? {})) {
			tools.add(tool)
		}
	})

	// Add always available tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))
	
	// Map tool descriptions for allowed tools
	const descriptions = Array.from(tools).map((toolName) => {
		const descriptionFn = toolDescriptionMap[toolName]
		if (!descriptionFn) {
			return undefined
		}

		return descriptionFn({
			...args,
			toolOptions: undefined, // No tool options in direct tool approach
		})
	})

	return `# Tools\n\n${descriptions.filter(Boolean).join("\n\n")}`
}

// Export individual description functions for backward compatibility
export {
	getAccessMcpResourceDescription, getReadFileDescription, getWriteToFileDescription, getSearchFilesDescription, getListFilesDescription,
	getDataviewQueryDescription, getAskFollowupQuestionDescription, getAttemptCompletionDescription, getSwitchModeDescription, getInsertContentDescription,
	getUseMcpToolDescription, getSearchAndReplaceDescription, getManageFilesDescription, getSearchWebDescription, getFetchUrlsContentDescription, getCallInsightsDescription as getCallInsightsDescription
}

