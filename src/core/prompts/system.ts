import * as path from 'path'

import { App, normalizePath } from 'obsidian'

import { CustomModeManager } from '../../database/json/custom-mode/CustomModeManager'
import { FilesSearchSettings } from "../../types/settings"
import {
	CustomModePrompts,
	Mode,
	ModeConfig,
	PromptComponent,
	defaultModeSlug,
	defaultModes,
	getModeBySlug
} from "../../utils/modes"
import { DiffStrategy } from "../diff/DiffStrategy"
import { McpHub } from "../mcp/McpHub"


import { ROOT_DIR } from './constants'
import {
	addCustomInstructions,
	getCapabilitiesSection,
	getMcpServersSection,
	getModesSection,
	getObjectiveSection,
	getRulesSection,
	getSharedToolUseSection,
	getToolUseGuidelinesSection,
	markdownFormattingSection
} from "./sections"
// import { loadSystemPromptFile } from "./sections/custom-system-prompt"
import { getToolDescriptionsForMode } from "./tools"


export class SystemPrompt {
	protected dataDir: string
	protected app: App
	private customModeManager: CustomModeManager

	constructor(app: App) {
		this.app = app
		this.dataDir = normalizePath(`${ROOT_DIR}`)
		this.customModeManager = new CustomModeManager(app)
		this.ensureDirectory()
	}

	private async ensureDirectory(): Promise<void> {
		if (!(await this.app.vault.adapter.exists(this.dataDir))) {
			await this.app.vault.adapter.mkdir(this.dataDir)
		}
	}

	private getSystemPromptFilePath(mode: Mode): string {
		// Format: {mode slug}_system_prompt.md
		return `${mode}/system_prompt.md`
	}

	private async loadSystemPromptFile(mode: Mode): Promise<string> {
		const fileName = this.getSystemPromptFilePath(mode)
		const filePath = normalizePath(path.join(this.dataDir, fileName))
		if (!(await this.app.vault.adapter.exists(filePath))) {
			return ""
		}
		const content = await this.app.vault.adapter.read(filePath)
		return content
	}

	/**
	 * Get the effective mode configuration, considering builtin overrides
	 */
	private async getEffectiveModeConfig(mode: Mode, customModes?: ModeConfig[]): Promise<ModeConfig | null> {
		// First try to find in custom modes
		const customMode = getModeBySlug(mode, customModes)
		if (customMode) {
			return customMode
		}

		// Check if there's a builtin mode override in database
		const builtinOverride = await this.customModeManager.findBuiltinModeOverride(mode)
		if (builtinOverride) {
			// Convert CustomMode to ModeConfig
			return {
				slug: builtinOverride.slug,
				name: builtinOverride.name,
				icon: builtinOverride.icon,
				roleDefinition: builtinOverride.roleDefinition,
				customInstructions: builtinOverride.customInstructions,
				tools: builtinOverride.tools,
				source: builtinOverride.source,
			}
		}

		// Fall back to builtin mode
		return defaultModes.find((m) => m.slug === mode) || defaultModes[0]
	}

	/**
	 * Generate the system prompt for a given mode
	 * @param cwd - The current working directory
	 * @param supportsComputerUse - Whether the computer use is supported
	 * @param mode - The mode to get the system prompt for
	 * @param searchSettings - The search settings
	 * @param filesSearchMethod - The files search method
	 * @param mcpHub - The MCP hub
	 * @param diffStrategy - The diff strategy
	 * @param browserViewportSize - The browser viewport size
	 * @param promptComponent - The prompt component
	 * @param customModeConfigs - The custom mode configurations
	 * @param globalCustomInstructions - The global custom instructions
	 * @param preferredLanguage - The preferred language
	 * @param diffEnabled - Whether the diff is enabled
	 * @param experiments - The experiments
	 * @param enableMcpServerCreation - Whether to enable MCP server creation
	 */
	private async generatePrompt(
		cwd: string,
		supportsComputerUse: boolean,
		mode: Mode,
		searchSettings: FilesSearchSettings,
		filesSearchMethod: string,
		mcpHub?: McpHub,
		diffStrategy?: DiffStrategy,
		browserViewportSize?: string,
		promptComponent?: PromptComponent,
		customModeConfigs?: ModeConfig[],
		globalCustomInstructions?: string,
		preferredLanguage?: string,
		diffEnabled?: boolean,
		experiments?: Record<string, boolean>,
		enableMcpServerCreation?: boolean,
	): Promise<string> {

		// Get the effective mode config (including builtin overrides)
		const modeConfig = await this.getEffectiveModeConfig(mode, customModeConfigs)
		if (!modeConfig) {
			throw new Error(`Mode '${mode}' not found`)
		}

		const roleDefinition = promptComponent?.roleDefinition || modeConfig.roleDefinition

		const [modesSection, mcpServersSection] = await Promise.all([
			getModesSection(),
			modeConfig.tools.some((tool) => tool === "use_mcp_tool" || tool === "access_mcp_resource")
				? getMcpServersSection(mcpHub, diffStrategy, enableMcpServerCreation)
				: Promise.resolve(""),
		])

		const basePrompt = `${roleDefinition}

${markdownFormattingSection()}

${getSharedToolUseSection()}

${getToolDescriptionsForMode(
			mode,
			cwd,
			searchSettings,
			filesSearchMethod,
			supportsComputerUse,
			diffStrategy,
			browserViewportSize,
			mcpHub,
			customModeConfigs,
			experiments,
		)}

${getToolUseGuidelinesSection(mode)}

${mcpServersSection}

${getCapabilitiesSection(
			mode,
			cwd,
			filesSearchMethod,
		)}

${modesSection}

${getRulesSection(
			mode,
			cwd,
			filesSearchMethod,
			supportsComputerUse,
			diffStrategy,
			experiments,
		)}

${getObjectiveSection(mode)}

${await addCustomInstructions(this.app, promptComponent?.customInstructions || modeConfig.customInstructions || "", globalCustomInstructions || "", cwd, mode, { preferredLanguage })}`

		return basePrompt
	}


	/**
	 * Get the system prompt for a given mode
	 * @param cwd - The current working directory
	 * @param supportsComputerUse - Whether the computer use is supported
	 * @param mode - The mode to get the system prompt for
	 * @param searchSettings - The search settings
	 * @param filesSearchMethod - The files search method
	 * @param preferredLanguage - The preferred language
	 * @param diffStrategy - The diff strategy
	 * @param customModePrompts - The custom mode prompts
	 * @param customModes - The custom modes
	 * @param mcpHub - The MCP hub
	 * @param browserViewportSize - The browser viewport size
	 * @param globalCustomInstructions - The global custom instructions
	 * @param diffEnabled - Whether the diff is enabled
	 * @param experiments - The experiments
	 * @param enableMcpServerCreation - Whether to enable MCP server creation
	 */
	public async getSystemPrompt(
		cwd: string,
		supportsComputerUse: boolean,
		mode: Mode = defaultModeSlug,
		searchSettings: FilesSearchSettings,
		filesSearchMethod: string = 'regex',
		preferredLanguage?: string,
		diffStrategy?: DiffStrategy,
		customModePrompts?: CustomModePrompts,
		customModes?: ModeConfig[],
		mcpHub?: McpHub,
		browserViewportSize?: string,
		globalCustomInstructions?: string,
		diffEnabled?: boolean,
		experiments?: Record<string, boolean>,
		enableMcpServerCreation?: boolean,
	): Promise<string> {

		const getPromptComponent = (value: unknown): PromptComponent | undefined => {
			if (typeof value === "object" && value !== null) {
				return value
			}
			return undefined
		}

		// Try to load custom system prompt from file
		const fileCustomSystemPrompt = await this.loadSystemPromptFile(mode)

		// Check if it's a custom mode
		const promptComponent = getPromptComponent(customModePrompts?.[mode])

		// Get effective mode config (including builtin overrides)
		const currentMode = await this.getEffectiveModeConfig(mode, customModes)
		if (!currentMode) {
			throw new Error(`Mode '${mode}' not found`)
		}

		// 1. use raw system prompt from mode config
		if (currentMode.tools.length === 0) {
			const roleDefinition = promptComponent?.roleDefinition || currentMode.roleDefinition
			const customInstructions = await addCustomInstructions(
				this.app,
				promptComponent?.customInstructions || currentMode.customInstructions || "",
				globalCustomInstructions || "",
				cwd,
				mode,
				{ preferredLanguage },
			)
			return `${roleDefinition}

${markdownFormattingSection()}

${customInstructions}`
		}

		// 2. If a file-based custom system prompt exists, use it
		if (fileCustomSystemPrompt) {
			const roleDefinition = promptComponent?.roleDefinition || currentMode.roleDefinition
			const customInstructions = await addCustomInstructions(
				this.app,
				promptComponent?.customInstructions || currentMode.customInstructions || "",
				globalCustomInstructions || "",
				cwd,
				mode,
				{ preferredLanguage },
			)
			return `${roleDefinition}

${fileCustomSystemPrompt}

${customInstructions}`
		}

		// 3. use infio default system prompt
		return this.generatePrompt(
			// context,
			cwd,
			supportsComputerUse,
			currentMode.slug,
			searchSettings,
			filesSearchMethod,
			mcpHub,
			diffStrategy,
			browserViewportSize,
			promptComponent,
			customModes,
			globalCustomInstructions,
			preferredLanguage,
			diffEnabled,
			experiments,
			enableMcpServerCreation,
		)
	}
}
