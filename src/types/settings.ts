import { z } from 'zod';

import { DEFAULT_MODELS } from '../constants';
import {
	MAX_DELAY,
	MAX_MAX_CHAR_LIMIT,
	MIN_DELAY,
	MIN_MAX_CHAR_LIMIT,
	MIN_MAX_TOKENS,
	fewShotExampleSchema,
	modelOptionsSchema
} from '../settings/versions/shared';
import { DEFAULT_SETTINGS } from "../settings/versions/v1/v1";
import { ApiProvider } from '../types/llm/model';
import { isRegexValid, isValidIgnorePattern } from '../utils/auto-complete';

export const SETTINGS_SCHEMA_VERSION = 0.5

const InfioProviderSchema = z.object({
	name: z.literal('Infio'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'Infio',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const OpenRouterProviderSchema = z.object({
	name: z.literal('OpenRouter'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'OpenRouter',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const SiliconFlowProviderSchema = z.object({
	name: z.literal('SiliconFlow'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'SiliconFlow',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const AlibabaQwenProviderSchema = z.object({
	name: z.literal('AlibabaQwen'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'AlibabaQwen',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const AnthropicProviderSchema = z.object({
	name: z.literal('Anthropic'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().optional(),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'Anthropic',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const DeepSeekProviderSchema = z.object({
	name: z.literal('DeepSeek'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'DeepSeek',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const GoogleProviderSchema = z.object({
	name: z.literal('Google'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'Google',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const OpenAIProviderSchema = z.object({
	name: z.literal('OpenAI'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().optional(),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'OpenAI',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const OpenAICompatibleProviderSchema = z.object({
	name: z.literal('OpenAICompatible'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().optional(),
	useCustomUrl: z.boolean().catch(true),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'OpenAICompatible',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: true,
	models: []
})

const OllamaProviderSchema = z.object({
	name: z.literal('Ollama'),
	apiKey: z.string().catch('ollama'),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'Ollama',
	apiKey: 'ollama',
	baseUrl: '',
	useCustomUrl: true,
	models: []
})

const GroqProviderSchema = z.object({
	name: z.literal('Groq'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'Groq',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const GrokProviderSchema = z.object({
	name: z.literal('Grok'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'Grok',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const MoonshotProviderSchema = z.object({
	name: z.literal('Moonshot'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'Moonshot',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const ZhipuAIProviderSchema = z.object({
	name: z.literal('ZhipuAI'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'ZhipuAI',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const LocalProviderSchema = z.object({
	name: z.literal('LocalProvider'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false),
	models: z.array(z.string()).catch([])
}).catch({
	name: 'LocalProvider',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false,
	models: []
})

const ollamaModelSchema = z.object({
	baseUrl: z.string().catch(''),
	model: z.string().catch(''),
})

const openAICompatibleModelSchema = z.object({
	baseUrl: z.string().catch(''),
	apiKey: z.string().catch(''),
	model: z.string().catch(''),
})

const ragOptionsSchema = z.object({
	filesystem: z.enum(['idb', 'opfs']).catch('opfs'),
	chunkSize: z.number().catch(500),
	batchSize: z.number().catch(32),
	thresholdTokens: z.number().catch(8192),
	minSimilarity: z.number().catch(0.0),
	limit: z.number().catch(10),
	excludePatterns: z.array(z.string()).catch([]),
	includePatterns: z.array(z.string()).catch([]),
})

export const triggerSchema = z.object({
	type: z.enum(['string', 'regex']),
	value: z.string().min(1, { message: "Trigger value must be at least 1 character long" })
}).strict().superRefine((trigger, ctx) => {
	if (trigger.type === "regex") {
		if (!trigger.value.endsWith("$")) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Regex triggers must end with a $.",
				path: ["value"],
			});
		}
		if (!isRegexValid(trigger.value)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: `Invalid regex: "${trigger.value}"`,
				path: ["value"],
			});
		}
	}
});

const FilesSearchSettingsSchema = z.object({
	method: z.enum(['match', 'regex', 'semantic', 'auto']).catch('auto'),
	regexBackend: z.enum(['coreplugin', 'ripgrep']).catch('coreplugin'),
	matchBackend: z.enum(['omnisearch', 'coreplugin']).catch('coreplugin'),
	ripgrepPath: z.string().catch(''),
}).catch({
	method: 'auto',
	regexBackend: 'coreplugin',
	matchBackend: 'coreplugin',
	ripgrepPath: '',
});

export const InfioSettingsSchema = z.object({
	// Version
	version: z.literal(SETTINGS_SCHEMA_VERSION).catch(SETTINGS_SCHEMA_VERSION),

	// Provider
	defaultProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	infioProvider: InfioProviderSchema,
	openrouterProvider: OpenRouterProviderSchema,
	siliconflowProvider: SiliconFlowProviderSchema,
	alibabaQwenProvider: AlibabaQwenProviderSchema,
	anthropicProvider: AnthropicProviderSchema,
	deepseekProvider: DeepSeekProviderSchema,
	openaiProvider: OpenAIProviderSchema,
	googleProvider: GoogleProviderSchema,
	ollamaProvider: OllamaProviderSchema,
	groqProvider: GroqProviderSchema,
	grokProvider: GrokProviderSchema,
	moonshotProvider: MoonshotProviderSchema,
	zhipuaiProvider: ZhipuAIProviderSchema,
	openaicompatibleProvider: OpenAICompatibleProviderSchema,
	localproviderProvider: LocalProviderSchema,

	// MCP Servers
	mcpEnabled: z.boolean().catch(false),

	// Chat Model start list
	collectedChatModels: z.array(z.object({
		provider: z.nativeEnum(ApiProvider),
		modelId: z.string(),
	})).catch([]),

	// Insight Model start list
	collectedInsightModels: z.array(z.object({
		provider: z.nativeEnum(ApiProvider),
		modelId: z.string(),
	})).catch([]),

	// Apply Model start list
	collectedApplyModels: z.array(z.object({
		provider: z.nativeEnum(ApiProvider),
		modelId: z.string(),
	})).catch([]),

	// Embedding Model start list
	collectedEmbeddingModels: z.array(z.object({
		provider: z.nativeEnum(ApiProvider),
		modelId: z.string(),
	})).catch([]),

	// Active Provider Tab (for UI state)
	activeProviderTab: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),

	// Chat Model 
	chatModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	chatModelId: z.string().catch(''),

	// Insight Model
	insightModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	insightModelId: z.string().catch(''),

	// Apply Model
	applyModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	applyModelId: z.string().catch(''),

	// Embedding Model
	embeddingModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	embeddingModelId: z.string().catch(''),

	// fuzzyMatchThreshold
	fuzzyMatchThreshold: z.number().catch(0.85),

	// experimentalDiffStrategy
	experimentalDiffStrategy: z.boolean().catch(false),

	// multiSearchReplaceDiffStrategy
	multiSearchReplaceDiffStrategy: z.boolean().catch(true),

	// Workspace
	workspace: z.string().catch(''),
	// Mode
	mode: z.string().catch('ask'),
	defaultMention: z.enum(['none', 'current-file', 'vault']).catch('none'),

	// web search
	serperApiKey: z.string().catch(''),
	serperSearchEngine: z.enum(['google', 'duckduckgo', 'bing']).catch('google'),
	jinaApiKey: z.string().catch(''),

	// Files Search
	filesSearchSettings: FilesSearchSettingsSchema,

	/// [compatible]
	// activeModels [compatible]
	activeModels: z.array(
		z.object({
			name: z.string(),
			provider: z.string(),
			enabled: z.boolean(),
			isEmbeddingModel: z.boolean(),
			isBuiltIn: z.boolean(),
			apiKey: z.string().optional(),
			baseUrl: z.string().optional(),
			dimension: z.number().optional(),
		})
	).catch(DEFAULT_MODELS),
	// API Keys [compatible]
	infioApiKey: z.string().catch(''),
	openAIApiKey: z.string().catch(''),
	anthropicApiKey: z.string().catch(''),
	geminiApiKey: z.string().catch(''),
	groqApiKey: z.string().catch(''),
	deepseekApiKey: z.string().catch(''),
	ollamaEmbeddingModel: ollamaModelSchema.catch({
		baseUrl: '',
		model: '',
	}),
	ollamaChatModel: ollamaModelSchema.catch({
		baseUrl: '',
		model: '',
	}),
	openAICompatibleChatModel: openAICompatibleModelSchema.catch({
		baseUrl: '',
		apiKey: '',
		model: '',
	}),
	ollamaApplyModel: ollamaModelSchema.catch({
		baseUrl: '',
		model: '',
	}),
	openAICompatibleApplyModel: openAICompatibleModelSchema.catch({
		baseUrl: '',
		apiKey: '',
		model: '',
	}),

	// System Prompt
	systemPrompt: z.string().catch(''),

	// RAG Options
	ragOptions: ragOptionsSchema.catch({
		filesystem: 'opfs',
		batchSize: 32,
		chunkSize: 500,
		thresholdTokens: 8192,
		minSimilarity: 0.0,
		limit: 10,
		excludePatterns: [],
		includePatterns: [],
	}),

	// autocomplete options
	autocompleteEnabled: z.boolean(),
	advancedMode: z.boolean(),

	// [compatible]
	apiProvider: z.enum(['azure', 'openai', "ollama"]),
	azureOAIApiSettings: z.string().catch(''),
	openAIApiSettings: z.string().catch(''),
	ollamaApiSettings: z.string().catch(''),

	triggers: z.array(triggerSchema),
	delay: z.number().int().min(MIN_DELAY, { message: "Delay must be between 0ms and 2000ms" }).max(MAX_DELAY, { message: "Delay must be between 0ms and 2000ms" }),
	modelOptions: modelOptionsSchema,
	systemMessage: z.string().min(3, { message: "System message must be at least 3 characters long" }),
	fewShotExamples: z.array(fewShotExampleSchema),
	userMessageTemplate: z.string().min(3, { message: "User message template must be at least 3 characters long" }),
	chainOfThoughRemovalRegex: z.string().refine((regex) => isRegexValid(regex), { message: "Invalid regex" }),
	dontIncludeDataviews: z.boolean(),
	maxPrefixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }),
	maxSuffixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }),
	removeDuplicateMathBlockIndicator: z.boolean(),
	removeDuplicateCodeBlockIndicator: z.boolean(),
	ignoredFilePatterns: z.string().refine((value) => value
		.split("\n")
		.filter(s => s.trim().length > 0)
		.filter(s => !isValidIgnorePattern(s)).length === 0,
		{ message: "Invalid ignore pattern" }
	),
	ignoredTags: z.string().refine((value) => value
		.split("\n")
		.filter(s => s.includes(" ")).length === 0, { message: "Tags cannot contain spaces" }
	).refine((value) => value
		.split("\n")
		.filter(s => s.includes("#")).length === 0, { message: "Enter tags without the # symbol" }
	).refine((value) => value
		.split("\n")
		.filter(s => s.includes(",")).length === 0, { message: "Enter each tag on a new line without commas" }
	),
	cacheSuggestions: z.boolean(),
	debugMode: z.boolean(),
})

export type InfioSettings = z.infer<typeof InfioSettingsSchema>
export type FilesSearchSettings = z.infer<typeof FilesSearchSettingsSchema>

type Migration = {
	fromVersion: number
	toVersion: number
	migrate: (data: Record<string, unknown>) => Record<string, unknown>
}

const MIGRATIONS: Migration[] = [
	{
		fromVersion: 0.1,
		toVersion: 0.4,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = 0.4
			return newData
		},
	},
	{
		fromVersion: 0.4,
		toVersion: 0.5,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION
			
			// Handle max_tokens minimum value increase from 800 to 4096
			if (newData.modelOptions && typeof newData.modelOptions === 'object') {
				const modelOptions = newData.modelOptions as Record<string, any>
				if (typeof modelOptions.max_tokens === 'number' && modelOptions.max_tokens < MIN_MAX_TOKENS) {
					console.log(`Updating max_tokens from ${modelOptions.max_tokens} to ${MIN_MAX_TOKENS} due to minimum value change`)
					modelOptions.max_tokens = MIN_MAX_TOKENS
				}
			}
			
			return newData
		},
	},
]

function migrateSettings(
	data: Record<string, unknown>,
): Record<string, unknown> {
	let currentData = { ...data }
	const currentVersion = (currentData.version as number) ?? 0

	for (const migration of MIGRATIONS) {
		if (
			currentVersion >= migration.fromVersion &&
			currentVersion < migration.toVersion &&
			migration.toVersion <= SETTINGS_SCHEMA_VERSION
		) {
			console.debug(
				`Migrating settings from ${migration.fromVersion} to ${migration.toVersion}`,
			)
			currentData = migration.migrate(currentData)
		}
	}

	return currentData
}

export function parseInfioSettings(data: unknown): InfioSettings {
	try {
		const migratedData = migrateSettings(data as Record<string, unknown>)
		return InfioSettingsSchema.parse(migratedData)
	} catch (error) {
		console.error("Failed to parse settings with migrated data, using default settings instead: ", error);
		return InfioSettingsSchema.parse({ ...DEFAULT_SETTINGS })
	}
}
