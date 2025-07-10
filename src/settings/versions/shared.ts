import { z } from "zod";

export const SETTINGS_SCHEMA_VERSION = 0.5;

export const MIN_DELAY = 0;
export const MAX_DELAY = 2000;
export const MIN_MAX_CHAR_LIMIT = 100;
export const MAX_MAX_CHAR_LIMIT = 10000;
export const MIN_MAX_TOKENS = 4096;
export const MAX_MAX_TOKENS = 8192;
export const MIN_TEMPERATURE = 0.0;
export const MAX_TEMPERATURE = 1.0;
export const MIN_TOP_P = 0.0;
export const MAX_TOP_P = 1.0;
export const MIN_FREQUENCY_PENALTY = 0;
export const MAX_FREQUENCY_PENALTY = 2;
export const MIN_PRESENCE_PENALTY = 0;
export const MAX_PRESENCE_PENALTY = 2;

export const modelOptionsSchema = z.object({
	temperature: z.number()
		.min(MIN_TEMPERATURE, { message: `Temperature must be at least ${MIN_TEMPERATURE}` }),
	top_p: z.number()
		.min(MIN_TOP_P, { message: `top_p must be greater than ${MIN_TOP_P}` })
		.max(MAX_TOP_P, { message: `top_p must be at most ${MAX_TOP_P}` }),
	frequency_penalty: z.number()
		.min(MIN_FREQUENCY_PENALTY, { message: `Frequency penalty must be at least ${MIN_FREQUENCY_PENALTY}` })
		.max(MAX_FREQUENCY_PENALTY, { message: `Frequency penalty must be at most ${MAX_FREQUENCY_PENALTY}` }),
	presence_penalty: z.number()
		.min(MIN_PRESENCE_PENALTY, { message: `Presence penalty must be at least ${MIN_PRESENCE_PENALTY}` })
		.max(MAX_PRESENCE_PENALTY, { message: `Presence penalty must be at most ${MAX_PRESENCE_PENALTY}` }),
	max_tokens: z.number().int()
		.min(MIN_MAX_TOKENS, { message: `max_tokens must be at least than ${MIN_MAX_TOKENS}` }),
}).strict();

export const fewShotExampleSchema = z.object({
	// TODO: figure out how to make this compatible with the context enum and its namespace.
	context: z.enum(["Text", "Heading", "BlockQuotes", "UnorderedList", "NumberedList", "CodeBlock", "MathBlock", "TaskList"]),
	input: z.string().min(3, { message: "The input must be at least 3 characters long" }),
	answer: z.string().min(3, { message: "The answer must be at least 3 characters long" }),
}).strict();

export type FewShotExample = z.infer<typeof fewShotExampleSchema>;

export const DeprecatedSettingsSchema = z.object({
	// Active Models [compatible]
  enabled: z.string().catch(''),
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
	).catch([]),
	// API Keys [compatible]
	infioApiKey: z.string().catch(''),
	openAIApiKey: z.string().catch(''),
	anthropicApiKey: z.string().catch(''),
	geminiApiKey: z.string().catch(''),
	groqApiKey: z.string().catch(''),
	deepseekApiKey: z.string().catch(''),
  // Model settings [compatible]
  embeddingModel: z.string().catch(''),
  chatModel: z.string().catch(''),
  applyModel: z.string().catch(''),
	ollamaEmbeddingModel: z.string().catch(''),
	ollamaChatModel: z.string().catch(''),
	openAICompatibleChatModel: z.string().catch(''),
	ollamaApplyModel: z.string().catch(''),
	openAICompatibleApplyModel: z.string().catch(''),
	// API Settings[compatible]
  apiProvider: z.string().catch(''),
	azureOAIApiSettings: z.string().catch(''),
	openAIApiSettings: z.string().catch(''),
	ollamaApiSettings: z.string().catch(''),
  ollamaBaseUrl: z.string().catch(''),
  // Web search settings [compatible]
  serpapiApiKey: z.string().catch(''),
  serpapiSearchEngine: z.string().catch(''),
  jinaApiKey: z.string().catch(''),
  // File search settings [compatible]
  filesSearchSettings: z.string().catch(''),
  filesSearchMethod: z.string().catch(''),
  ripgrepPath: z.string().catch(''),
  // Dics
  chainOfThoughRemovalRegex: z.string().catch(''),
}).catch({
	// Active Models [compatible]
  enabled: '',
	activeModels: [],
	// API Keys [compatible]
	infioApiKey: '',
	openAIApiKey: '',
	anthropicApiKey: '',
	geminiApiKey: '',
	groqApiKey: '',
	deepseekApiKey: '',
  // Model settings [compatible]
  embeddingModel: '',
  chatModel: '',
  applyModel: '',
	ollamaEmbeddingModel: '',
	ollamaChatModel: '',
	openAICompatibleChatModel: '',
	ollamaApplyModel: '',
	openAICompatibleApplyModel: '',
	// API Settings[compatible]
  apiProvider: '',
	azureOAIApiSettings: '',
	openAIApiSettings: '',
	ollamaApiSettings: '',
  ollamaBaseUrl: '',
  // Web search settings [compatible]
  serpapiApiKey: '',
  serpapiSearchEngine: '',
  jinaApiKey: '',
  // File search settings [compatible]
  filesSearchSettings: '',
  filesSearchMethod: '',
  ripgrepPath: '',
  // Disc settings [compatible]
  chainOfThoughRemovalRegex: '',
});