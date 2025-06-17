import { z } from 'zod';

import {
  SETTINGS_SCHEMA_VERSION,
	MAX_DELAY,
	MAX_MAX_CHAR_LIMIT,
	MIN_DELAY,
	MIN_MAX_CHAR_LIMIT,
	fewShotExampleSchema,
	modelOptionsSchema,
  DeprecatedSettingsSchema,
} from '../settings/versions/shared';
import { DEFAULT_SETTINGS } from "../settings/versions/v1/v1";
import { migrateSettings } from "../settings/versions/migration"
import { ApiProvider } from '../types/llm/model';
import { isRegexValid, isValidIgnorePattern } from '../utils/auto-complete';

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

const WebSearchSettingsSchema = z.object({
	webSearchBackend: z.enum(['serpapi', 'scrapingdog', 'serper', 'jina', 'duckduckgo', 'brave']).catch('serpapi'),
  urlFetchBackend: z.enum(['local', 'jina']).catch('jina'),
	serpapiApiKey: z.string().catch(''),
	serpapiSearchEngine: z.enum(['google', 'duckduckgo', 'bing']).catch('google'),
  scrapingdogApiKey: z.string().catch(''),
	scrapingdogSearchEngine: z.enum(['google', 'bing']).catch('google'),
	serperApiKey: z.string().catch(''),
  jinaApiKey: z.string().catch(''),
  braveApiKey: z.string().catch(''),
}).catch({
	webSearchBackend: 'serpapi',
	urlFetchBackend: 'jina',
	serpapiApiKey: '',
	serpapiSearchEngine: 'google',
  scrapingdogApiKey: '',
	scrapingdogSearchEngine: 'google',
	serperApiKey: '',
  jinaApiKey: '',
  braveApiKey: '',
});

const FileSearchSettingsSchema = z.object({
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
	openaicompatibleProvider: OpenAICompatibleProviderSchema,

	// MCP Servers
	mcpEnabled: z.boolean().catch(false),

	// Chat Model start list
	collectedChatModels: z.array(z.object({
		provider: z.nativeEnum(ApiProvider),
		modelId: z.string(),
	})).catch([]),

	// Active Provider Tab (for UI state)
	activeProviderTab: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),

	// Chat Model
	chatModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	chatModelId: z.string().catch(''),
	// Apply Model
	applyModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	applyModelId: z.string().catch(''),
	// Embedding Model
	embeddingModelProvider: z.nativeEnum(ApiProvider).catch(ApiProvider.Infio),
	embeddingModelId: z.string().catch(''),

	// Fuzzy Match Threshold
	fuzzyMatchThreshold: z.number().catch(0.85),

	// Experimental Diff Strategy
	experimentalDiffStrategy: z.boolean().catch(false),

	// Multi Search Replace Diff Strategy
	multiSearchReplaceDiffStrategy: z.boolean().catch(true),

	// Mode
	mode: z.string().catch('ask'),
	defaultMention: z.enum(['none', 'current-file', 'vault']).catch('none'),

	// Web Search
	webSearchSettings: WebSearchSettingsSchema,

	// File Search
	fileSearchSettings: FileSearchSettingsSchema,

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

	// Autocomplete options
	autocompleteEnabled: z.boolean().catch(true),
	advancedMode: z.boolean().catch(false),

  // Trigger settings
	triggers: z.array(triggerSchema),
	delay: z.number().int().min(MIN_DELAY, { message: "Delay must be between 0ms and 2000ms" }).max(MAX_DELAY, { message: "Delay must be between 0ms and 2000ms" }).catch(500),
	// Request settings
  modelOptions: modelOptionsSchema,
	// Prompt settings
  systemMessage: z.string().min(3, { message: "System message must be at least 3 characters long" }),
	fewShotExamples: z.array(fewShotExampleSchema),
	userMessageTemplate: z.string().min(3, { message: "User message template must be at least 3 characters long" }),
	chainOfThoughtRemovalRegex: z.string().refine((regex) => isRegexValid(regex), { message: "Invalid regex" }),
	// Preprocessing settings
  dontIncludeDataviews: z.boolean().catch(true),
	maxPrefixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }).catch(4000),
	maxSuffixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }).catch(4000),
	// Postprocessing settings
  removeDuplicateMathBlockIndicator: z.boolean().catch(true),
	removeDuplicateCodeBlockIndicator: z.boolean().catch(true),
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
	cacheSuggestions: z.boolean().catch(true),
	debugMode: z.boolean().catch(false),

  // Keep deprecated settings for compatibility.
  deprecated: DeprecatedSettingsSchema,
})

export type InfioSettings = z.infer<typeof InfioSettingsSchema>
export type WebSearchSettings = z.infer<typeof WebSearchSettingsSchema>
export type FileSearchSettings = z.infer<typeof FileSearchSettingsSchema>

export function parseInfioSettings(data: unknown): InfioSettings {
  try {
    const testSchema = InfioSettingsSchema.strict();
    return testSchema.parse(data);
  } catch {
    console.log(`Old/non-standard settings format detected, attempting to migrate...`);
    const migratedData = migrateSettings(data as Record<string, unknown>);

    try {
      return InfioSettingsSchema.parse(migratedData);
    } catch {
      // Instead of hard resetting, we can attempt to parse the migrated data
      // and catch specific errors to fix or use defaults.
      console.log("Failed to parse settings with migrated data, attempting to fix...");
      const fixedData: Record<string, any> = {};
      const defaultSettings = DEFAULT_SETTINGS;

      // Iterate over the schema keys to build the fixed data
      for (const key in InfioSettingsSchema.shape) {
        const schema = InfioSettingsSchema.shape[key];
        try {
          fixedData[key] = schema.parse(migratedData[key]);
        } catch {
          console.log(`Failed to parse key '${key}' with migrated data, using default key instead.`);
          fixedData[key] = defaultSettings[key];
        }
      }

      try {
        return InfioSettingsSchema.parse(fixedData);
      } catch (error) {
        console.error("Failed to fix settings with migrated data, using default settings instead: ", error);
        return InfioSettingsSchema.parse({ ...DEFAULT_SETTINGS })
      }
    }
	}
}