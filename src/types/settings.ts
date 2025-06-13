import { z } from 'zod';

import { DEFAULT_MODELS } from '../constants';
import {
	MAX_DELAY,
	MAX_MAX_CHAR_LIMIT,
	MIN_DELAY,
	MIN_MAX_CHAR_LIMIT,
	fewShotExampleSchema,
	modelOptionsSchema
} from '../settings/versions/shared';
import { DEFAULT_SETTINGS } from "../settings/versions/v1/v1";
import { ApiProvider } from '../types/llm/model';
import { isRegexValid, isValidIgnorePattern } from '../utils/auto-complete';

export const SETTINGS_SCHEMA_VERSION = 0.4

const InfioProviderSchema = z.object({
	name: z.literal('Infio'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'Infio',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const OpenRouterProviderSchema = z.object({
	name: z.literal('OpenRouter'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'OpenRouter',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const SiliconFlowProviderSchema = z.object({
	name: z.literal('SiliconFlow'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'SiliconFlow',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const AlibabaQwenProviderSchema = z.object({
	name: z.literal('AlibabaQwen'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'AlibabaQwen',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const AnthropicProviderSchema = z.object({
	name: z.literal('Anthropic'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().optional(),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'Anthropic',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const DeepSeekProviderSchema = z.object({
	name: z.literal('DeepSeek'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'DeepSeek',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const GoogleProviderSchema = z.object({
	name: z.literal('Google'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'Google',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const OpenAIProviderSchema = z.object({
	name: z.literal('OpenAI'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().optional(),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'OpenAI',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const OpenAICompatibleProviderSchema = z.object({
	name: z.literal('OpenAICompatible'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().optional(),
	useCustomUrl: z.boolean().catch(true)
}).catch({
	name: 'OpenAICompatible',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: true
})

const OllamaProviderSchema = z.object({
	name: z.literal('Ollama'),
	apiKey: z.string().catch('ollama'),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'Ollama',
	apiKey: 'ollama',
	baseUrl: '',
	useCustomUrl: true
})

const GroqProviderSchema = z.object({
	name: z.literal('Groq'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'Groq',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
})

const GrokProviderSchema = z.object({
	name: z.literal('Grok'),
	apiKey: z.string().catch(''),
	baseUrl: z.string().catch(''),
	useCustomUrl: z.boolean().catch(false)
}).catch({
	name: 'Grok',
	apiKey: '',
	baseUrl: '',
	useCustomUrl: false
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
	chunkSize: z.number().catch(1000),
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
	regexBackend: z.enum(['coreplugin', 'ripgrep']).catch('ripgrep'),
	matchBackend: z.enum(['omnisearch', 'coreplugin']).catch('coreplugin'),
	ripgrepPath: z.string().catch(''),
}).catch({
	method: 'auto',
	regexBackend: 'ripgrep',
	matchBackend: 'coreplugin',
	ripgrepPath: '',
});

export const InfioSettingsSchema = z.object({
	// Version
	version: z.literal(SETTINGS_SCHEMA_VERSION).catch(SETTINGS_SCHEMA_VERSION),

	// Provider
	defaultProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.OpenRouter),
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
	openaicompatibleProvider: OpenAICompatibleProviderSchema,

	// MCP Servers
	mcpEnabled: z.boolean().catch(false),

	// Chat Model start list
	collectedChatModels: z.array(z.object({
		provider: z.nativeEnum(ApiProvider),
		modelId: z.string(),
	})).catch([]),

	// Chat Model 
	chatModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.OpenRouter),
	chatModelId: z.string().catch(''),

	// Apply Model
	applyModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.OpenRouter),
	applyModelId: z.string().catch(''),

	// Embedding Model
	embeddingModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Google),
	embeddingModelId: z.string().catch(''),

	// fuzzyMatchThreshold
	fuzzyMatchThreshold: z.number().catch(0.85),

	// experimentalDiffStrategy
	experimentalDiffStrategy: z.boolean().catch(false),

	// multiSearchReplaceDiffStrategy
	multiSearchReplaceDiffStrategy: z.boolean().catch(true),

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
		chunkSize: 1000,
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
	chainOfThoughtRemovalRegex: z.string().refine((regex) => isRegexValid(regex), { message: "Invalid regex" }),
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
			newData.version = SETTINGS_SCHEMA_VERSION
			return newData
		},
	},

	// A very inelegant fix, but whatever :/
	// TODO: Should be rewritten in a future release
	{
		fromVersion: 0.4,
		toVersion: 0.4,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION

			// Replace 'chainOfThoughRemovalRegex' with 'chainOfThoughtRemovalRegex'
			if (newData.chainOfThoughRemovalRegex) {
				const cotRemovalRegexKey = newData.chainOfThoughRemovalRegex;
				delete newData.chainOfThoughRemovalRegex;
				newData.chainOfThoughtRemovalRegex = cotRemovalRegexKey;
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
			console.log(
				`Migrating settings from ${migration.fromVersion} to ${migration.toVersion}`,
			)
			currentData = migration.migrate(currentData)
		}
	}

	return currentData
}

export function parseInfioSettings(data: unknown): InfioSettings {
	const migratedData = migrateSettings(data as Record<string, unknown>);

	try {
		return InfioSettingsSchema.parse(migratedData)
	} catch (error) {
		// Instead of hard resetting, we can attempt to parse the migrated data
		// and catch specific errors to fix or use defaults.
		console.error("Failed to parse settings with migrated data, attempting to fix: ", error);
		const fixedData: Record<string, any> = {};
		const defaultSettings = DEFAULT_SETTINGS;

		// Iterate over the schema keys to build the fixed data
		for (const key in InfioSettingsSchema.shape) {
			const schema = InfioSettingsSchema.shape[key];
			try {
				fixedData[key] = schema.parse((migratedData as any)[key]);
			} catch {
				fixedData[key] = (defaultSettings as any)[key];
			}
		}

		try {
			return InfioSettingsSchema.parse(fixedData);
		} catch (fixError) {
			console.error("Failed to fix settings with migrated data, using default settings instead: ", fixError);
		return InfioSettingsSchema.parse({ ...DEFAULT_SETTINGS })
		}
	}
}
