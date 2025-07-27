import { App } from "obsidian"

import { addCustomInstructions } from "../core/prompts/sections/custom-instructions"

import { ALWAYS_AVAILABLE_TOOLS, TOOL_DISPLAY_NAMES, TOOL_GROUPS, ToolGroup } from "./tool-groups"

// Mode types
export type Mode = string

// Group options type (keeping for backward compatibility during transition)
export type GroupOptions = {
	fileRegex?: string // Regular expression pattern
	description?: string // Human-readable description of the pattern
}

// Group entry can be either a string or tuple with options (keeping for backward compatibility)
export type GroupEntry = ToolGroup | readonly [ToolGroup, GroupOptions]

// Mode configuration type
export type ModeConfig = {
	slug: string
	name: string
	icon?: string
	roleDefinition: string
	customInstructions?: string
	tools: string[] // Changed from groups to tools array
	source?: "global" | "project" // Where this mode was loaded from
}

// Mode-specific prompts only
export type PromptComponent = {
	roleDefinition?: string
	customInstructions?: string
}

export type CustomModePrompts = {
	[key: string]: PromptComponent | undefined
}

// Helper to get all available tools for UI selection
export function getAllAvailableTools(): { name: string; displayName: string }[] {
	const allTools = new Set<string>()
	
	// Add tools from all groups except always available ones
	Object.values(TOOL_GROUPS).forEach(group => {
		if (!group.alwaysAvailable) {
			group.tools.forEach(tool => allTools.add(tool))
		}
	})
	
	return Array.from(allTools).map(tool => ({
		name: tool,
		displayName: TOOL_DISPLAY_NAMES[tool as keyof typeof TOOL_DISPLAY_NAMES] || tool
	}))
}

// Helper to extract group name regardless of format (keeping for backward compatibility)
export function getGroupName(group: GroupEntry): ToolGroup {
	if (typeof group === "string") {
		return group
	}

	return group[0]
}

// Helper to get group options if they exist (keeping for backward compatibility)
function getGroupOptions(group: GroupEntry): GroupOptions | undefined {
	return Array.isArray(group) ? group[1] : undefined
}

// Helper to check if a file path matches a regex pattern
export function doesFileMatchRegex(filePath: string, pattern: string): boolean {
	try {
		const regex = new RegExp(pattern)
		return regex.test(filePath)
	} catch (error) {
		console.error(`Invalid regex pattern: ${pattern}`, error)
		return false
	}
}

// Helper to get all tools for a mode - now directly returns mode.tools + always available
export function getToolsForMode(mode: ModeConfig): string[] {
	const tools = new Set<string>()

	// Add tools from mode configuration
	mode.tools.forEach(tool => tools.add(tool))

	// Always add required tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	return Array.from(tools)
}

// Legacy helper for backward compatibility with groups (can be removed later)
export function getToolsForModeFromGroups(groups: readonly GroupEntry[]): string[] {
	const tools = new Set<string>()

	// Add tools from each group
	groups.forEach((group) => {
		const groupName = getGroupName(group)
		const groupConfig = TOOL_GROUPS[groupName]
		if (groupConfig) {
			groupConfig.tools.forEach((tool: string) => tools.add(tool))
		} else {
			console.warn(`Tool group '${groupName}' not found in TOOL_GROUPS`)
		}
	})

	// Always add required tools
	ALWAYS_AVAILABLE_TOOLS.forEach((tool) => tools.add(tool))

	return Array.from(tools)
}

// Main modes configuration as an ordered array
export const defaultModes: ModeConfig[] = [
	{
		slug: "ask",
		name: "Ask",
		icon: "message-square",
		roleDefinition:
			"You are Infio, an AI knowledge vault researcher acting as an intelligent partner to the user. Your core mission is to help them explore, understand, and organize their personal knowledge by deeply analyzing their Obsidian vault, understanding their questions, finding the most relevant information, and synthesizing clear, evidence-based answers. You are not a general chatbot; every response must be grounded in the user's note contents. Treat each question as a micro-research task while providing thoughtful explanations and practical guidance.",
		tools: ["read_file", "list_files", "search_files", "dataview_query", "insights", "use_mcp_tool", "access_mcp_resource"],
		customInstructions:
			"You are collaborating with a USER to help them explore, understand, and organize information within their personal knowledge vault. Each time the USER sends a message, they may provide context about their current notes, vault structure, or specific knowledge needs. This information may or may not be relevant to their inquiry, it is up for you to decide.\n\nYour main goal is to provide informative responses, thoughtful explanations, and practical guidance on any topic or challenge they face, while leveraging their existing knowledge base when relevant. You can analyze information, explain concepts across various domains, and access external resources when helpful. Make sure to address the user's questions thoroughly with thoughtful explanations and practical guidance. Use visual aids like Mermaid diagrams when they help make complex topics clearer. Offer solutions to challenges from diverse fields, not just technical ones, and provide context that helps users better understand the subject matter.",
	},
	{
		slug: "write",
		name: "Write",
		icon: "square-pen",
		roleDefinition:
			"You are Infio, an AI writing assistant and collaborative partner within Obsidian. Your core mission is to help users create, edit, and organize written content, transforming their ideas into well-structured, clearly formatted documents that seamlessly integrate with their knowledge vault. You are an expert in Markdown and focus on enhancing readability, structure, and coherence, acting as a dedicated partner in the user's writing process.",
		tools: ["read_file", "list_files", "search_files", "dataview_query", "apply_diff", "write_to_file", "insert_content", "search_and_replace", "use_mcp_tool", "access_mcp_resource", "manage_files"],
		customInstructions:
			"You are collaborating with a USER to help them create, edit, and organize various types of written content within their knowledge vault. Each time the USER sends a message, they may provide context about their current documents, writing goals, or organizational needs. This information may or may not be relevant to their writing task, it is up for you to decide.\n\nYour main goal is to help them express their ideas effectively through well-structured, clearly formatted content that integrates seamlessly with their existing knowledge system. You can create and modify any text-based files, with particular expertise in Markdown formatting. Help users organize their thoughts, create documentation, take notes, or draft any written content they need. When appropriate, suggest structural improvements and formatting enhancements that make content more readable and accessible. Consider the purpose and audience of each document to provide the most relevant assistance."
	},
	{
		slug: "learn",
		name: "Learn",
		icon: "book-open",
		roleDefinition:
			"You are Infio, an AI learning assistant powered by advanced language models. You operate within Obsidian.",
		tools: ["read_file", "list_files", "search_files", "dataview_query", "insights", "use_mcp_tool", "access_mcp_resource"],
		customInstructions:
			"You are collaborating with a USER to enhance their learning experience within their knowledge vault. Each time the USER sends a message, they may provide context about their learning materials, study goals, or knowledge gaps. This information may or may not be relevant to their learning journey, it is up for you to decide.\n\nYour main goal is to help them actively learn and understand complex topics by transforming information into more digestible formats, creating connections between concepts, and facilitating deep comprehension. You excel at breaking down complex topics into manageable chunks, creating study materials like flashcards and summaries, and helping users build comprehensive understanding through structured learning approaches. Generate visual learning aids like concept maps and flowcharts using Mermaid diagrams when they enhance comprehension. Create organized study materials including key concepts, definitions, and practice questions. Help users connect new information to their existing knowledge base by identifying relationships and patterns across their notes. Focus on active learning techniques that promote retention and understanding rather than passive information consumption."
	},
	{
		slug: "research",
		name: "Research",
		icon: "search",
		roleDefinition:
			"You are Infio, an AI research assistant powered by advanced language models. You operate within Obsidian.",
		tools: ["search_web", "fetch_urls_content", "use_mcp_tool", "access_mcp_resource"],
		customInstructions:
			"You are collaborating with a USER to conduct comprehensive research and analytical thinking within their knowledge vault. Each time the USER sends a message, they may provide context about their research questions, existing notes, or analytical needs. This information may or may not be relevant to their research, it is up for you to decide.\n\nYour main goal is to help them break down complex questions, explore multiple perspectives, and synthesize information to reach well-reasoned conclusions while building upon their existing knowledge base. You can conduct thorough research by analyzing available information, connecting related concepts, and applying structured reasoning methods. Help users explore topics in depth by considering multiple angles, identifying relevant evidence, and evaluating the reliability of sources. Use step-by-step analysis when tackling complex problems, explaining your thought process clearly. Create visual representations like Mermaid diagrams when they help clarify relationships between ideas. Use Markdown tables to present statistical data or comparative information when appropriate. Present balanced viewpoints while highlighting the strength of evidence behind different conclusions.",
	},
	{
		slug: "raw",
		name: "Raw",
		icon: "command",
		roleDefinition: "You are an expert at interpreting the heart and spirit of a question and answering in an insightful manner.",
		tools: [],
		customInstructions: `# STEPS

- Deeply understand what's being asked.

- Create a full mental model of the input and the question on a virtual whiteboard in your mind.

- Answer the question in 3-5 Markdown bullets of 10 words each.

# OUTPUT INSTRUCTIONS

- Only output Markdown bullets.

- Do not output warnings or notes—just the requested sections.`,
	}
]

// Export the default mode slug
export const defaultModeSlug = defaultModes[0].slug

// Helper functions
export function getModeBySlug(slug: string, customModes?: ModeConfig[]): ModeConfig | undefined {
	// Check custom modes first
	const customMode = customModes?.find((mode) => mode.slug === slug)
	if (customMode) {
		return customMode
	}
	// Then check built-in modes
	return defaultModes.find((mode) => mode.slug === slug)
}

export function getModeConfig(slug: string, customModes?: ModeConfig[]): ModeConfig {
	const mode = getModeBySlug(slug, customModes)
	if (!mode) {
		throw new Error(`No mode found for slug: ${slug}`)
	}
	return mode
}

// Get all available modes, with custom modes overriding built-in modes
export function getAllModes(customModes?: ModeConfig[]): ModeConfig[] {
	if (!customModes?.length) {
		return [...defaultModes]
	}

	// Start with built-in modes
	const allModes = [...defaultModes]

	// Process custom modes
	customModes.forEach((customMode) => {
		const index = allModes.findIndex((mode) => mode.slug === customMode.slug)
		if (index !== -1) {
			// Override existing mode
			allModes[index] = customMode
		} else {
			// Add new mode
			allModes.push(customMode)
		}
	})

	return allModes
}

// Check if a mode is custom or an override
export function isCustomMode(slug: string, customModes?: ModeConfig[]): boolean {
	return !!customModes?.some((mode) => mode.slug === slug)
}

// Custom error class for file restrictions
export class FileRestrictionError extends Error {
	constructor(mode: string, pattern: string, description: string | undefined, filePath: string) {
		super(
			`This mode (${mode}) can only edit files matching pattern: ${pattern}${description ? ` (${description})` : ""}. Got: ${filePath}`,
		)
		this.name = "FileRestrictionError"
	}
}

export function isToolAllowedForMode(
	tool: string,
	modeSlug: string,
	customModes: ModeConfig[],
	toolRequirements?: Record<string, boolean>,
	toolParams?: Record<string, any>, // All tool parameters
	experiments?: Record<string, boolean>,
): boolean {
	// Always allow these tools
	if (ALWAYS_AVAILABLE_TOOLS.includes(tool as any)) {
		return true
	}

	if (experiments && tool in experiments) {
		if (!experiments[tool]) {
			return false
		}
	}

	// Check tool requirements if any exist
	if (toolRequirements && tool in toolRequirements) {
		if (!toolRequirements[tool]) {
			return false
		}
	}

	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		return false
	}

	// Check if tool is in the mode's tools list
	return mode.tools.includes(tool)
}

// Create the mode-specific default prompts
export const defaultPrompts: Readonly<CustomModePrompts> = Object.freeze(
	Object.fromEntries(
		defaultModes.map((mode) => [
			mode.slug,
			{
				roleDefinition: mode.roleDefinition,
				customInstructions: mode.customInstructions,
			},
		]),
	),
)

// Helper function to get all modes with their prompt overrides from extension state
export async function getAllModesWithPrompts(): Promise<ModeConfig[]> {
	// const customModes = (await context.globalState.get<ModeConfig[]>("customModes")) || []
	// const customModePrompts = (await context.globalState.get<CustomModePrompts>("customModePrompts")) || {}

	const allModes = getAllModes()
	return allModes.map((mode) => ({
		...mode,
		roleDefinition: mode.roleDefinition,
		customInstructions: mode.customInstructions,
	}))
}

// Helper function to get complete mode details with all overrides
export async function getFullModeDetails(
	app: App,
	modeSlug: string,
	customModes?: ModeConfig[],
	customModePrompts?: CustomModePrompts,
	options?: {
		cwd?: string
		globalCustomInstructions?: string
		preferredLanguage?: string
	},
): Promise<ModeConfig> {
	// First get the base mode config from custom modes or built-in modes
	const baseMode = getModeBySlug(modeSlug, customModes) || defaultModes.find((m) => m.slug === modeSlug) || defaultModes[0]

	// Check for any prompt component overrides
	const promptComponent = customModePrompts?.[modeSlug]

	// Get the base custom instructions
	const baseCustomInstructions = promptComponent?.customInstructions || baseMode.customInstructions || ""

	// If we have cwd, load and combine all custom instructions
	let fullCustomInstructions = baseCustomInstructions
	if (options?.cwd) {
		fullCustomInstructions = await addCustomInstructions(
			app,
			baseCustomInstructions,
			options.globalCustomInstructions || "",
			options.cwd,
			modeSlug,
			{ preferredLanguage: options.preferredLanguage },
		)
	}

	// Return mode with any overrides applied
	return {
		...baseMode,
		roleDefinition: promptComponent?.roleDefinition || baseMode.roleDefinition,
		customInstructions: fullCustomInstructions,
	}
}

// Helper function to safely get role definition
export function getRoleDefinition(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.roleDefinition
}

// Helper function to safely get custom instructions
export function getCustomInstructions(modeSlug: string, customModes?: ModeConfig[]): string {
	const mode = getModeBySlug(modeSlug, customModes)
	if (!mode) {
		console.warn(`No mode found for slug: ${modeSlug}`)
		return ""
	}
	return mode.customInstructions ?? ""
}
