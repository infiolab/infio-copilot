import { INFIO_BASE_URL, OPENROUTER_BASE_URL } from '../constants'
import { ApiProvider } from '../types/llm/model'
import { InfioSettings } from '../types/settings'

export interface ModelInfo {
	maxTokens?: number
	contextWindow?: number
	supportsImages?: boolean
	supportsComputerUse?: boolean
	supportsPromptCache: boolean // this value is hardcoded for now
	inputPrice?: number
	outputPrice?: number
	cacheWritesPrice?: number
	cacheReadsPrice?: number
	description?: string
	reasoningEffort?: string,
	thinking?: boolean
	maxThinkingTokens?: number
	supportsReasoningBudget?: boolean
	requiredReasoningBudget?: boolean
	tiers?: readonly {
		readonly contextWindow: number,
		readonly inputPrice: number,
		readonly outputPrice: number,
		readonly cacheReadsPrice: number,
	}[]
}

export interface EmbeddingModelInfo {
	dimensions: number
	description?: string
}

// Anthropic
// https://docs.anthropic.com/en/docs/about-claude/models
export type AnthropicModelId = keyof typeof anthropicModels
export const anthropicDefaultModelId: AnthropicModelId = "claude-sonnet-4-20250514"
export const anthropicDefaultAutoCompleteModelId: AnthropicModelId = "claude-3-5-haiku-20241022"
export const anthropicDefaultEmbeddingModelId: AnthropicModelId = null // this is not supported embedding model
export const anthropicModels = {
	"claude-sonnet-4-20250514": {
		maxTokens: 64_000, // Overridden to 8k if `enableReasoningEffort` is false.
		contextWindow: 200_000,
		supportsImages: true,
		supportsComputerUse: true,
		supportsPromptCache: true,
		inputPrice: 3.0, // $3 per million input tokens
		outputPrice: 15.0, // $15 per million output tokens
		cacheWritesPrice: 3.75, // $3.75 per million tokens
		cacheReadsPrice: 0.3, // $0.30 per million tokens
		supportsReasoningBudget: true,
	},
	"claude-opus-4-20250514": {
		maxTokens: 32_000, // Overridden to 8k if `enableReasoningEffort` is false.
		contextWindow: 200_000,
		supportsImages: true,
		supportsComputerUse: true,
		supportsPromptCache: true,
		inputPrice: 15.0, // $15 per million input tokens
		outputPrice: 75.0, // $75 per million output tokens
		cacheWritesPrice: 18.75, // $18.75 per million tokens
		cacheReadsPrice: 1.5, // $1.50 per million tokens
		supportsReasoningBudget: true,
	},
	"claude-3-7-sonnet-20250219:thinking": {
		maxTokens: 128_000, // Unlocked by passing `beta` flag to the model. Otherwise, it's 64k.
		contextWindow: 200_000,
		supportsImages: true,
		supportsComputerUse: true,
		supportsPromptCache: true,
		inputPrice: 3.0, // $3 per million input tokens
		outputPrice: 15.0, // $15 per million output tokens
		cacheWritesPrice: 3.75, // $3.75 per million tokens
		cacheReadsPrice: 0.3, // $0.30 per million tokens
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
	},
	"claude-3-7-sonnet-20250219": {
		maxTokens: 8192, // Since we already have a `:thinking` virtual model we aren't setting `supportsReasoningBudget: true` here.
		contextWindow: 200_000,
		supportsImages: true,
		supportsComputerUse: true,
		supportsPromptCache: true,
		inputPrice: 3.0, // $3 per million input tokens
		outputPrice: 15.0, // $15 per million output tokens
		cacheWritesPrice: 3.75, // $3.75 per million tokens
		cacheReadsPrice: 0.3, // $0.30 per million tokens
	},
	"claude-3-5-sonnet-20241022": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: true,
		supportsComputerUse: true,
		supportsPromptCache: true,
		inputPrice: 3.0, // $3 per million input tokens
		outputPrice: 15.0, // $15 per million output tokens
		cacheWritesPrice: 3.75, // $3.75 per million tokens
		cacheReadsPrice: 0.3, // $0.30 per million tokens
	},
	"claude-3-5-haiku-20241022": {
		maxTokens: 8192,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 1.0,
		outputPrice: 5.0,
		cacheWritesPrice: 1.25,
		cacheReadsPrice: 0.1,
	},
	"claude-3-opus-20240229": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 15.0,
		outputPrice: 75.0,
		cacheWritesPrice: 18.75,
		cacheReadsPrice: 1.5,
	},
	"claude-3-haiku-20240307": {
		maxTokens: 4096,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.25,
		outputPrice: 1.25,
		cacheWritesPrice: 0.3,
		cacheReadsPrice: 0.03,
	},
} as const satisfies Record<string, ModelInfo> // as const assertion makes the object 

// Infio
export const infioDefaultModelId = "gemini/gemini-2.5-pro-preview-06-05" // for chat
export const infioDefaultAutoCompleteModelId = "groq/llama-3.3-70b-versatile" // for auto complete
export const infioDefaultEmbeddingModelId = "openai/text-embedding-3-small" // for embedding
export const infioDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 65_536,
	supportsImages: false,
	supportsComputerUse: true,
	supportsPromptCache: true,
	inputPrice: 0.272,
	outputPrice: 1.088,
	cacheWritesPrice: 0.14,
	cacheReadsPrice: 0.014,
}
let infioModelsCache: Record<string, ModelInfo> | null = null;

async function fetchInfioModels(apiKey?: string): Promise<Record<string, ModelInfo>> {
	if (infioModelsCache) {
		return infioModelsCache;
	}

	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json'
		};

		// 添加Authorization请求头，使用Bearer格式，如果有API密钥的话
		if (apiKey) {
			headers['Authorization'] = `Bearer ${apiKey}`;
		}

		const response = await fetch(INFIO_BASE_URL + "/model_group/info", {
			method: 'GET',
			headers: headers
		});
		const data = await response.json();
		const models: Record<string, ModelInfo> = {};
		if (data?.data) {
			for (const model of data.data) {
				models[model.model_group] = {
					maxTokens: model.max_output_tokens,
					contextWindow: model.max_input_tokens,
					supportsImages: false,
					supportsPromptCache: false,
					inputPrice: model.input_cost_per_token ? model.input_cost_per_token * 1000000 : 0,
					outputPrice: model.output_cost_per_token ? model.output_cost_per_token * 1000000 : 0,
				};
			}
		}

		infioModelsCache = models;
		return models;
	} catch (error) {
		console.error('Failed to fetch Infio models:', error);
		// 如果出错，返回默认模型
		return {
			[infioDefaultModelId]: infioDefaultModelInfo
		};
	}
}

export const infioEmbeddingModels = {
	"openai/text-embedding-3-small": {
		dimensions: 1536,
		description: "Increased performance over 2nd generation ada embedding model"
	},
	"gemini/gemini-embedding-exp-03-07": {
		dimensions: 1024,
		description: "Most capable 2nd generation embedding model, replacing 16 first generation models"
	},
	"deepseek/embedding-large-text": {
		dimensions: 1024,
		description: "Most capable embedding model for both English and non-English tasks"
	},
	"deepseek/embedding-text": {
		dimensions: 512,
		description: "Most capable embedding model for both English and non-English tasks"
	}
} as const satisfies Record<string, EmbeddingModelInfo>


// OpenRouter
// https://openrouter.ai/models?order=newest&supported_parameters=tools
export const openRouterDefaultModelId = "google/gemini-2.5-pro-preview" // for chat
export const openRouterDefaultAutoCompleteModelId = "google/gemini-2.5-flash-preview-05-20" // for auto complete
export const openRouterDefaultEmbeddingModelId = null // this is not supported embedding model
export const openRouterDefaultModelInfo: ModelInfo = {
	maxTokens: 8192,
	contextWindow: 200_000,
	supportsImages: true,
	supportsComputerUse: true,
	supportsPromptCache: true,
	inputPrice: 3.0,
	outputPrice: 15.0,
	cacheWritesPrice: 3.75,
	cacheReadsPrice: 0.3,
	description:
		"The new Claude 3.5 Sonnet delivers better-than-Opus capabilities, faster-than-Sonnet speeds, at the same Sonnet prices. Sonnet is particularly good at:\n\n- Coding: New Sonnet scores ~49% on SWE-Bench Verified, higher than the last best score, and without any fancy prompt scaffolding\n- Data science: Augments human data science expertise; navigates unstructured data while using multiple tools for insights\n- Visual processing: excelling at interpreting charts, graphs, and images, accurately transcribing text to derive insights beyond just the text alone\n- Agentic tasks: exceptional tool use, making it great at agentic tasks (i.e. complex, multi-step problem solving tasks that require engaging with other systems)\n\n#multimodal",
}
let openRouterModelsCache: Record<string, ModelInfo> | null = null;
async function fetchOpenRouterModels(): Promise<Record<string, ModelInfo>> {
	if (openRouterModelsCache) {
		return openRouterModelsCache;
	}

	try {
		const response = await fetch(OPENROUTER_BASE_URL + "/models");
		const data = await response.json();
		const models: Record<string, ModelInfo> = {};

		if (data?.data) {
			for (const model of data.data) {
				models[model.id] = {
					maxTokens: model.top_provider?.max_completion_tokens ?? model.context_length,
					contextWindow: model.context_length,
					supportsImages: model.architecture?.modality?.includes("image") ?? false,
					supportsPromptCache: false,
					inputPrice: model.pricing?.prompt ?? 0,
					outputPrice: model.pricing?.completion ?? 0,
					description: model.description,
				};
			}
		}

		openRouterModelsCache = models;
		return models;
	} catch (error) {
		console.error('Failed to fetch OpenRouter models:', error);
		return {
			[openRouterDefaultModelId]: openRouterDefaultModelInfo
		};
	}
}

// Gemini
// https://ai.google.dev/gemini-api/docs/models/gemini
export type GeminiModelId = keyof typeof geminiModels
export const geminiDefaultModelId: GeminiModelId = "gemini-2.5-pro-preview-05-06"
export const geminiDefaultAutoCompleteModelId: GeminiModelId = "gemini-2.5-flash-preview-05-20"
export const geminiDefaultEmbeddingModelId: keyof typeof geminiEmbeddingModels = "text-embedding-004"

export const geminiModels = {
	"gemini-2.5-flash-preview-05-20:thinking": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.15,
		outputPrice: 3.5,
		cacheReadsPrice: 0.0375,
		cacheWritesPrice: 1.0,
		maxThinkingTokens: 24_576,
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
	},
	"gemini-2.5-flash-preview-05-20": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.15,
		outputPrice: 0.6,
		cacheReadsPrice: 0.0375,
		cacheWritesPrice: 1.0,
	},
	"gemini-2.5-flash-preview-04-17:thinking": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 3.5,
		maxThinkingTokens: 24_576,
		supportsReasoningBudget: true,
		requiredReasoningBudget: true,
	},
	"gemini-2.5-flash-preview-04-17": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.15,
		outputPrice: 0.6,
	},
	"gemini-2.5-pro-exp-03-25": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-2.5-pro-preview-03-25": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 2.5, // This is the pricing for prompts above 200k tokens.
		outputPrice: 15,
		cacheReadsPrice: 0.625,
		cacheWritesPrice: 4.5,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 1.25,
				outputPrice: 10,
				cacheReadsPrice: 0.31,
			},
			{
				contextWindow: Infinity,
				inputPrice: 2.5,
				outputPrice: 15,
				cacheReadsPrice: 0.625,
			},
		],
	},
	"gemini-2.5-pro-preview-05-06": {
		maxTokens: 65_535,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 2.5, // This is the pricing for prompts above 200k tokens.
		outputPrice: 15,
		cacheReadsPrice: 0.625,
		cacheWritesPrice: 4.5,
		tiers: [
			{
				contextWindow: 200_000,
				inputPrice: 1.25,
				outputPrice: 10,
				cacheReadsPrice: 0.31,
			},
			{
				contextWindow: Infinity,
				inputPrice: 2.5,
				outputPrice: 15,
				cacheReadsPrice: 0.625,
			},
		],
	},
	"gemini-2.0-flash-001": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.1,
		outputPrice: 0.4,
		cacheReadsPrice: 0.025,
		cacheWritesPrice: 1.0,
	},
	"gemini-2.0-flash-lite-preview-02-05": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-2.0-pro-exp-02-05": {
		maxTokens: 8192,
		contextWindow: 2_097_152,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-2.0-flash-thinking-exp-01-21": {
		maxTokens: 65_536,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-2.0-flash-thinking-exp-1219": {
		maxTokens: 8192,
		contextWindow: 32_767,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-2.0-flash-exp": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-1.5-flash-002": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.15, // This is the pricing for prompts above 128k tokens.
		outputPrice: 0.6,
		cacheReadsPrice: 0.0375,
		cacheWritesPrice: 1.0,
		tiers: [
			{
				contextWindow: 128_000,
				inputPrice: 0.075,
				outputPrice: 0.3,
				cacheReadsPrice: 0.01875,
			},
			{
				contextWindow: Infinity,
				inputPrice: 0.15,
				outputPrice: 0.6,
				cacheReadsPrice: 0.0375,
			},
		],
	},
	"gemini-1.5-flash-exp-0827": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-1.5-flash-8b-exp-0827": {
		maxTokens: 8192,
		contextWindow: 1_048_576,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-1.5-pro-002": {
		maxTokens: 8192,
		contextWindow: 2_097_152,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-1.5-pro-exp-0827": {
		maxTokens: 8192,
		contextWindow: 2_097_152,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemini-exp-1206": {
		maxTokens: 8192,
		contextWindow: 2_097_152,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
} as const satisfies Record<string, ModelInfo>

export const geminiEmbeddingModels = {
	"text-embedding-004": {
		dimensions: 768,
		description: "The text-embedding-004 model can generate advanced embeddings for words, phrases, and sentences. The resulting embeddings can then be used for tasks such as semantic search, text classification, clustering, and more."
	}
} as const satisfies Record<string, EmbeddingModelInfo>

// OpenAI Native
// https://openai.com/api/pricing/
export type OpenAiNativeModelId = keyof typeof openAiNativeModels
export const openAiNativeDefaultModelId: OpenAiNativeModelId = "gpt-4o"
export const openAiNativeDefaultAutoCompleteModelId: OpenAiNativeModelId = "gpt-4o-mini"
export const openAiNativeDefaultEmbeddingModelId: keyof typeof openAINativeEmbeddingModels = "text-embedding-3-small"

export const openAiNativeModels = {
	// don't support tool use yet
	"o3-mini": {
		maxTokens: 100_000,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 1.1,
		outputPrice: 4.4,
		reasoningEffort: "medium",
	},
	"o3-mini-high": {
		maxTokens: 100_000,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 1.1,
		outputPrice: 4.4,
		reasoningEffort: "high",
	},
	"o3-mini-low": {
		maxTokens: 100_000,
		contextWindow: 200_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 1.1,
		outputPrice: 4.4,
		reasoningEffort: "low",
	},
	"o1-pro": {
		maxTokens: 100_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 150,
		outputPrice: 600,
	},
	o1: {
		maxTokens: 100_000,
		contextWindow: 200_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 15,
		outputPrice: 60,
	},
	"o1-preview": {
		maxTokens: 32_768,
		contextWindow: 128_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 15,
		outputPrice: 60,
	},
	"o1-mini": {
		maxTokens: 65_536,
		contextWindow: 128_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 1.1,
		outputPrice: 4.4,
	},
	"gpt-4.5-preview": {
		maxTokens: 16_384,
		contextWindow: 128_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 75,
		outputPrice: 150,
	},
	"gpt-4o": {
		maxTokens: 16_384,
		contextWindow: 128_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 2.5,
		outputPrice: 10,
	},
	"gpt-4o-mini": {
		maxTokens: 16_384,
		contextWindow: 128_000,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0.15,
		outputPrice: 0.6,
	},
} as const satisfies Record<string, ModelInfo>
export const openAINativeEmbeddingModels = {
	"text-embedding-3-small": {
		dimensions: 1536,
		description: "Increased performance over 2nd generation ada embedding model"
	},
	"text-embedding-3-large": {
		dimensions: 3072,
		description: "Most capable embedding model for both English and non-English tasks"
	},
	"text-embedding-ada-002": {
		dimensions: 1536,
		description: "Most capable 2nd generation embedding model, replacing 16 first generation models"
	}
} as const satisfies Record<string, EmbeddingModelInfo>

// DeepSeek
// https://api-docs.deepseek.com/quick_start/pricing
export type DeepSeekModelId = keyof typeof deepSeekModels
export const deepSeekDefaultModelId: DeepSeekModelId = "deepseek-chat"
export const deepSeekDefaultAutoCompleteModelId: DeepSeekModelId = "deepseek-chat"
export const deepSeekDefaultEmbeddingModelId = null // this is not supported embedding model

export const deepSeekModels = {
	"deepseek-chat": {
		maxTokens: 8_000,
		contextWindow: 64_000,
		supportsImages: false,
		supportsPromptCache: true, // supports context caching, but not in the way anthropic does it (deepseek reports input tokens and reads/writes in the same usage report) FIXME: we need to show users cache stats how deepseek does it
		inputPrice: 0.272, // technically there is no input price, it's all either a cache hit or miss (ApiOptions will not show this)
		outputPrice: 1.088,
		cacheWritesPrice: 0.14,
		cacheReadsPrice: 0.014,
	},
	"deepseek-reasoner": {
		maxTokens: 8_000,
		contextWindow: 64_000,
		supportsImages: false,
		supportsPromptCache: true, // supports context caching, but not in the way anthropic does it (deepseek reports input tokens and reads/writes in the same usage report) FIXME: we need to show users cache stats how deepseek does it
		inputPrice: 0, // technically there is no input price, it's all either a cache hit or miss (ApiOptions will not show this)
		outputPrice: 2.19,
		cacheWritesPrice: 0.55,
		cacheReadsPrice: 0.14,
	},
} as const satisfies Record<string, ModelInfo>

// Qwen
// https://help.aliyun.com/zh/model-studio/getting-started/
export type QwenModelId = keyof typeof qwenModels
export const qwenDefaultModelId: QwenModelId = "qwen3-235b-a22b"
export const qwenDefaultAutoCompleteModelId: QwenModelId = "qwen3-32b"
export const qwenDefaultEmbeddingModelId: keyof typeof qwenEmbeddingModels = "text-embedding-v3"

export const qwenModels = {
	"qwen3-235b-a22b": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.002,
		outputPrice: 0.006,
		cacheWritesPrice: 0.002,
		cacheReadsPrice: 0.006,
	},
	"qwen3-32b": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.002,
		outputPrice: 0.006,
	},
	"qwen3-30b-a3b": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.002,
		outputPrice: 0.006,
	},
	"qwen3-14b": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.002,
		outputPrice: 0.006,
	},
	"qwen3-8b": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.002,
		outputPrice: 0.006,
	},
	"qwen2.5-coder-32b-instruct": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.002,
		outputPrice: 0.006,
		cacheWritesPrice: 0.002,
		cacheReadsPrice: 0.006,
	},
	"qwen2.5-coder-14b-instruct": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.002,
		outputPrice: 0.006,
		cacheWritesPrice: 0.002,
		cacheReadsPrice: 0.006,
	},
	"qwen2.5-coder-7b-instruct": {
		maxTokens: 8_192,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.001,
		outputPrice: 0.002,
		cacheWritesPrice: 0.001,
		cacheReadsPrice: 0.002,
	},
	"qwen2.5-coder-3b-instruct": {
		maxTokens: 8_192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		cacheWritesPrice: 0.0,
		cacheReadsPrice: 0.0,
	},
	"qwen2.5-coder-1.5b-instruct": {
		maxTokens: 8_192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		cacheWritesPrice: 0.0,
		cacheReadsPrice: 0.0,
	},
	"qwen2.5-coder-0.5b-instruct": {
		maxTokens: 8_192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		cacheWritesPrice: 0.0,
		cacheReadsPrice: 0.0,
	},
	"qwen-coder-plus-latest": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 3.5,
		outputPrice: 7,
		cacheWritesPrice: 3.5,
		cacheReadsPrice: 7,
	},
	"qwen-plus-latest": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.8,
		outputPrice: 2,
		cacheWritesPrice: 0.8,
		cacheReadsPrice: 0.2,
	},
	"qwen-turbo-latest": {
		maxTokens: 1_000_000,
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.8,
		outputPrice: 2,
		cacheWritesPrice: 0.8,
		cacheReadsPrice: 2,
	},
	"qwen-max-latest": {
		maxTokens: 30_720,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.4,
		outputPrice: 9.6,
		cacheWritesPrice: 2.4,
		cacheReadsPrice: 9.6,
	},
	"qwq-plus-latest": {
		maxTokens: 8_192,
		contextWindow: 131_071,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		cacheWritesPrice: 0.0,
		cacheReadsPrice: 0.0,
	},
	"qwq-plus": {
		maxTokens: 8_192,
		contextWindow: 131_071,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.0,
		outputPrice: 0.0,
		cacheWritesPrice: 0.0,
		cacheReadsPrice: 0.0,
	},
	"qwen-coder-plus": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 3.5,
		outputPrice: 7,
		cacheWritesPrice: 3.5,
		cacheReadsPrice: 7,
	},
	"qwen-plus": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.8,
		outputPrice: 2,
		cacheWritesPrice: 0.8,
		cacheReadsPrice: 0.2,
	},
	"qwen-turbo": {
		maxTokens: 1_000_000,
		contextWindow: 1_000_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 0.6,
		cacheWritesPrice: 0.3,
		cacheReadsPrice: 0.6,
	},
	"qwen-max": {
		maxTokens: 30_720,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.4,
		outputPrice: 9.6,
		cacheWritesPrice: 2.4,
		cacheReadsPrice: 9.6,
	},
	"deepseek-v3": {
		maxTokens: 8_000,
		contextWindow: 64_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.28,
		cacheWritesPrice: 0.14,
		cacheReadsPrice: 0.014,
	},
	"deepseek-r1": {
		maxTokens: 8_000,
		contextWindow: 64_000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 2.19,
		cacheWritesPrice: 0.55,
		cacheReadsPrice: 0.14,
	},
	"qwen-vl-max": {
		maxTokens: 30_720,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 9,
		cacheWritesPrice: 3,
		cacheReadsPrice: 9,
	},
	"qwen-vl-max-latest": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 3,
		outputPrice: 9,
		cacheWritesPrice: 3,
		cacheReadsPrice: 9,
	},
	"qwen-vl-plus": {
		maxTokens: 6_000,
		contextWindow: 8_000,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 1.5,
		outputPrice: 4.5,
		cacheWritesPrice: 1.5,
		cacheReadsPrice: 4.5,
	},
	"qwen-vl-plus-latest": {
		maxTokens: 129_024,
		contextWindow: 131_072,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 1.5,
		outputPrice: 4.5,
		cacheWritesPrice: 1.5,
		cacheReadsPrice: 4.5,
	},
} as const satisfies Record<string, ModelInfo>
export const qwenEmbeddingModels = {
	"text-embedding-v3": {
		dimensions: 1024,
		description: "支持50+主流语种，包括中文、英语、西班牙语、法语、葡萄牙语、印尼语、日语、韩语、德语、俄罗斯语等。最大行数20，单行最大处理8,192 Token。支持可选维度：1,024（默认）、768或512。单价：0.0007元/千Token。免费额度：50万Token（有效期180天）。"
	},
	"text-embedding-v2": {
		dimensions: 1536,
		description: "支持多种语言，包括中文、英语、西班牙语、法语、葡萄牙语、印尼语、日语、韩语、德语、俄罗斯语。最大行数25，单行最大处理2,048 Token。"
	},
	"text-embedding-v1": {
		dimensions: 1536,
		description: "支持中文、英语、西班牙语、法语、葡萄牙语、印尼语。"
	},
	"text-embedding-async-v2": {
		dimensions: 1536,
		description: "异步处理大规模文本。支持中文、英语、西班牙语、法语、葡萄牙语、印尼语、日语、韩语、德语、俄罗斯语。"
	},
	"text-embedding-async-v1": {
		dimensions: 1536,
		description: "异步处理大规模文本。支持中文、英语、西班牙语、法语、葡萄牙语、印尼语。"
	}
} as const satisfies Record<string, EmbeddingModelInfo>

// bytedance volcengine
//https://api.volcengine.com/api-docs/view/overview


// SiliconFlow
// https://docs.siliconflow.cn/
export type SiliconFlowModelId = keyof typeof siliconFlowModels
export const siliconFlowDefaultModelId: SiliconFlowModelId = "deepseek-ai/DeepSeek-V3"
export const siliconFlowDefaultAutoCompleteModelId: SiliconFlowModelId = "deepseek-ai/DeepSeek-V3"
export const siliconFlowDefaultEmbeddingModelId: keyof typeof siliconFlowEmbeddingModels = "BAAI/bge-m3"

export const siliconFlowModels = {
	"01-ai/Yi-1.5-9B-Chat-16K": {
		maxTokens: 8192,
		contextWindow: 16_384,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"01-ai/Yi-1.5-34B-Chat-16K": {
		maxTokens: 8192,
		contextWindow: 16_384,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"google/gemma-2-9b-it": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"google/gemma-2-27b-it": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"Pro/google/gemma-2-9b-it": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"meta-llama/Meta-Llama-3.1-8B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"Pro/meta-llama/Meta-Llama-3.1-8B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"meta-llama/Meta-Llama-3.1-70B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 4.0,
	},
	"meta-llama/Meta-Llama-3.1-405B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 5.0,
		outputPrice: 10.0,
	},
	"internlm/internlm2_5-20b-chat": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.8,
		outputPrice: 1.6,
	},
	"Qwen/Qwen2.5-72B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 4.0,
	},
	"Qwen/Qwen2.5-7B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.8,
	},
	"Qwen/Qwen2.5-14B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.6,
		outputPrice: 1.2,
	},
	"Qwen/Qwen2.5-32B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"Qwen/Qwen2.5-Coder-7B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.8,
	},
	"Qwen/Qwen2.5-VL-32B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.8,
	},
	"Qwen/Qwen2.5-VL-72B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.8,
	},
	"TeleAI/TeleChat2": {
		maxTokens: 4096,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 0.6,
	},
	"Pro/Qwen/Qwen2.5-7B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.8,
	},
	"Qwen/Qwen2.5-72B-Instruct-128K": {
		maxTokens: 8192,
		contextWindow: 128_000,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 4.0,
	},
	"Qwen/Qwen2-VL-72B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 2.5,
		outputPrice: 5.0,
	},
	"OpenGVLab/InternVL2-26B": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"Pro/BAAI/bge-m3": {
		maxTokens: 4096,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 0.6,
	},
	"Pro/OpenGVLab/InternVL2-8B": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"Vendor-A/Qwen/Qwen2.5-72B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 4.0,
	},
	"Pro/Qwen/Qwen2-VL-7B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"LoRA/Qwen/Qwen2.5-7B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.8,
	},
	"Pro/Qwen/Qwen2.5-Coder-7B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.4,
		outputPrice: 0.8,
	},
	"LoRA/Qwen/Qwen2.5-72B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 4.0,
	},
	"Qwen/Qwen2.5-Coder-32B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"Pro/BAAI/bge-reranker-v2-m3": {
		maxTokens: 4096,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.3,
		outputPrice: 0.6,
	},
	"Qwen/QwQ-32B": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"Qwen/QwQ-32B-Preview": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"AIDC-AI/Marco-o1": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"LoRA/Qwen/Qwen2.5-14B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.6,
		outputPrice: 1.2,
	},
	"LoRA/Qwen/Qwen2.5-32B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 1.0,
		outputPrice: 2.0,
	},
	"meta-llama/Llama-3.3-70B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 2.0,
		outputPrice: 4.0,
	},
	"LoRA/meta-llama/Meta-Llama-3.1-8B-Instruct": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"deepseek-ai/deepseek-vl2": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0.5,
		outputPrice: 1.0,
	},
	"Qwen/QVQ-72B-Preview": {
		maxTokens: 8192,
		contextWindow: 32_768,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 2.5,
		outputPrice: 5.0,
	},
	"deepseek-ai/DeepSeek-V3": {
		maxTokens: 8000,
		contextWindow: 64000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.28,
		cacheWritesPrice: 0.14,
		cacheReadsPrice: 0.014,
	},
	"deepseek-ai/DeepSeek-R1": {
		maxTokens: 8000,
		contextWindow: 64000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 2.19,
		cacheWritesPrice: 0.55,
		cacheReadsPrice: 0.14,
	},
	"Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B": {
		maxTokens: 4096,
		contextWindow: 16_384,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.2,
		cacheWritesPrice: 0.1,
		cacheReadsPrice: 0.01,
	},
	"Pro/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B": {
		maxTokens: 8000,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.4,
		cacheWritesPrice: 0.2,
		cacheReadsPrice: 0.02,
	},
	"Pro/deepseek-ai/DeepSeek-R1-Distill-Llama-8B": {
		maxTokens: 8000,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.4,
		cacheWritesPrice: 0.2,
		cacheReadsPrice: 0.02,
	},
	"deepseek-ai/DeepSeek-R1-Distill-Qwen-14B": {
		maxTokens: 8000,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.6,
		cacheWritesPrice: 0.3,
		cacheReadsPrice: 0.03,
	},
	"deepseek-ai/DeepSeek-R1-Distill-Qwen-32B": {
		maxTokens: 8000,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 1.0,
		cacheWritesPrice: 0.5,
		cacheReadsPrice: 0.05,
	},
	"deepseek-ai/DeepSeek-R1-Distill-Llama-70B": {
		maxTokens: 8000,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 2.0,
		cacheWritesPrice: 1.0,
		cacheReadsPrice: 0.1,
	},
	"deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B": {
		maxTokens: 4096,
		contextWindow: 16_384,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.2,
		cacheWritesPrice: 0.1,
		cacheReadsPrice: 0.01,
	},
	"deepseek-ai/DeepSeek-R1-Distill-Qwen-7B": {
		maxTokens: 8000,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.4,
		cacheWritesPrice: 0.2,
		cacheReadsPrice: 0.02,
	},
	"deepseek-ai/DeepSeek-R1-Distill-Llama-8B": {
		maxTokens: 8000,
		contextWindow: 32_768,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.4,
		cacheWritesPrice: 0.2,
		cacheReadsPrice: 0.02,
	},
	"Pro/deepseek-ai/DeepSeek-R1": {
		maxTokens: 8000,
		contextWindow: 64000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 2.19,
		cacheWritesPrice: 0.55,
		cacheReadsPrice: 0.14,
	},
	"Pro/deepseek-ai/DeepSeek-V3": {
		maxTokens: 8000,
		contextWindow: 64000,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0.28,
		cacheWritesPrice: 0.14,
		cacheReadsPrice: 0.014,
	}
} as const satisfies Record<string, ModelInfo>

export const siliconFlowEmbeddingModels = {
	"BAAI/bge-m3": {
		dimensions: 1024,
		description: "BGE-M3 是一个多功能、多语言、多粒度的文本嵌入模型。它支持三种常见的检索功能：密集检索、多向量检索和稀疏检索。该模型可以处理超过100种语言，并且能够处理从短句到长达8192个词元的长文档等不同粒度的输入。BGE-M3在多语言和跨语言检索任务中表现出色，在 MIRACL 和 MKQA 等基准测试中取得了领先结果。它还具有处理长文档检索的能力，在 MLDR 和 NarritiveQA 等数据集上展现了优秀性能"
	},
	"netease-youdao/bce-embedding-base_v1": {
		dimensions: 768,
		description: "bce-embedding-base_v1 是由网易有道开发的双语和跨语言嵌入模型。该模型在中英文语义表示和检索任务中表现出色，尤其擅长跨语言场景。它是为检索增强生成（RAG）系统优化的，可以直接应用于教育、医疗、法律等多个领域。该模型不需要特定指令即可使用，能够高效地生成语义向量，为语义搜索和问答系统提供关键支持"
	},
	"BAAI/bge-large-zh-v1.5": {
		dimensions: 1024,
		description: "BAAI/bge-large-zh-v1.5 是一个大型中文文本嵌入模型，是 BGE (BAAI General Embedding) 系列的一部分。该模型在 C-MTEB 基准测试中表现出色，在 31 个数据集上的平均得分为 64.53，在检索、语义相似度、文本对分类等多个任务中都取得了优异成绩。它支持最大 512 个 token 的输入长度，适用于各种中文自然语言处理任务，如文本检索、语义相似度计算等"
	},
	"BAAI/bge-large-en-v1.5": {
		dimensions: 1024,
		description: "BAAI/bge-large-en-v1.5 是一个大型英文文本嵌入模型，是 BGE (BAAI General Embedding) 系列的一部分。它在 MTEB 基准测试中取得了优异的表现，在 56 个数据集上的平均得分为 64.23，在检索、聚类、文本对分类等多个任务中表现出色。该模型支持最大 512 个 token 的输入长度，适用于各种自然语言处理任务，如文本检索、语义相似度计算等"
	},
	"Pro/BAAI/bge-m3": {
		dimensions: 1024,
		description: "BGE-M3 是一个多功能、多语言、多粒度的文本嵌入模型。它支持三种常见的检索功能：密集检索、多向量检索和稀疏检索。该模型可以处理超过100种语言，并且能够处理从短句到长达8192个词元的长文档等不同粒度的输入。BGE-M3在多语言和跨语言检索任务中表现出色，在 MIRACL 和 MKQA 等基准测试中取得了领先结果。它还具有处理长文档检索的能力，在 MLDR 和 NarritiveQA 等数据集上展现了优秀性能"
	}
} as const satisfies Record<string, EmbeddingModelInfo>

// Groq
// https://console.groq.com/docs/overview
export type GroqModelId = keyof typeof groqModels
export const groqDefaultModelId: GroqModelId = "llama-3.3-70b-versatile"
export const groqDefaultAutoCompleteModelId: GroqModelId = "llama-3.3-70b-versatile"
export const groqDefaultEmbeddingModelId = null // this is not supported embedding model

export const groqModels = {
	"meta-llama/llama-4-scout-17b-16e-instruct": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"meta-llama/llama-4-maverick-17b-128e-instruct": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"qwen-qwq-32b": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
	},
	"llama-3.2-1b-preview": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama-3.1-8b-instant": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"mixtral-8x7b-32768": {
		maxTokens: 4096,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama-3.3-70b-versatile": {
		maxTokens: 4096,
		contextWindow: 32768,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama-guard-3-8b": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama3-70b-8192": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama-3.3-70b-specdec": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama3-8b-8192": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama-3.2-11b-vision-preview": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"deepseek-r1-distill-llama-70b": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama-3.2-3b-preview": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"qwen-2.5-coder-32b": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"gemma2-9b-it": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"deepseek-r1-distill-qwen-32b": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"qwen-2.5-32b": {
		maxTokens: 4096,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
	"llama-3.2-90b-vision-preview": {
		maxTokens: 4096,
		contextWindow: 8192,
		supportsImages: true,
		supportsPromptCache: false,
		inputPrice: 0,
		outputPrice: 0,
	},
} as const satisfies Record<string, ModelInfo>

// Grok
// https://docs.x.ai/docs/models
export type GrokModelId = keyof typeof grokModels
export const grokDefaultModelId: GrokModelId = "grok-3"
export const grokDefaultAutoCompleteModelId: GrokModelId = "grok-3-mini-fast"
export const grokDefaultEmbeddingModelId = null // this is not supported embedding model

export const grokModels = {
	"grok-3": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
	},
	"grok-3-fast": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
	},
	"grok-3-mini": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
	},
	"grok-3-mini-fast": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: false,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
	},
	"grok-2-latest": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
	},
	"grok-2": {
		maxTokens: 8192,
		contextWindow: 131072,
		supportsImages: true,
		supportsPromptCache: true,
		inputPrice: 0,
		outputPrice: 0,
	}
} as const satisfies Record<string, ModelInfo>

/// helper functions
// get all providers, used for the provider dropdown
export const GetAllProviders = (): ApiProvider[] => {
	return [
		ApiProvider.Infio,
		ApiProvider.OpenRouter,
		ApiProvider.Anthropic,
		ApiProvider.OpenAI,
		ApiProvider.Google,
		ApiProvider.Grok,
		ApiProvider.AlibabaQwen,
		ApiProvider.SiliconFlow,
		ApiProvider.Deepseek,
		ApiProvider.Groq,
		ApiProvider.Ollama,
		ApiProvider.OpenAICompatible,
	]
}

export const GetEmbeddingProviders = (): ApiProvider[] => {
	return [
		ApiProvider.Infio,
		ApiProvider.OpenAI,
		ApiProvider.Google,
		ApiProvider.AlibabaQwen,
		ApiProvider.SiliconFlow,
		ApiProvider.OpenAICompatible,
		ApiProvider.Ollama,
	]
}

// Get all models for a provider
export const GetProviderModels = async (provider: ApiProvider, settings?: InfioSettings): Promise<Record<string, ModelInfo>> => {
	switch (provider) {
		case ApiProvider.Infio: {
			const apiKey = settings?.infioProvider?.apiKey
			return await fetchInfioModels(apiKey)
		}
		case ApiProvider.OpenRouter:
			return await fetchOpenRouterModels()
		case ApiProvider.OpenAI:
			return openAiNativeModels
		case ApiProvider.AlibabaQwen:
			return qwenModels
		case ApiProvider.SiliconFlow:
			return siliconFlowModels
		case ApiProvider.Anthropic:
			return anthropicModels
		case ApiProvider.Deepseek:
			return deepSeekModels
		case ApiProvider.Google:
			return geminiModels
		case ApiProvider.Groq:
			return groqModels
		case ApiProvider.Grok:
			return grokModels
		case ApiProvider.Ollama:
			return {}
		case ApiProvider.OpenAICompatible:
			return {}
		default:
			return {}
	}
}

// Get all models for a provider with settings (needed for providers that require API keys)
export const GetProviderModelsWithSettings = async (provider: ApiProvider, settings?: InfioSettings): Promise<Record<string, ModelInfo>> => {
	switch (provider) {
		case ApiProvider.Infio: {
			const apiKey = settings?.infioProvider?.apiKey
			return await fetchInfioModels(apiKey)
		}
		case ApiProvider.OpenRouter:
			return await fetchOpenRouterModels()
		case ApiProvider.OpenAI:
			return openAiNativeModels
		case ApiProvider.AlibabaQwen:
			return qwenModels
		case ApiProvider.SiliconFlow:
			return siliconFlowModels
		case ApiProvider.Anthropic:
			return anthropicModels
		case ApiProvider.Deepseek:
			return deepSeekModels
		case ApiProvider.Google:
			return geminiModels
		case ApiProvider.Groq:
			return groqModels
		case ApiProvider.Grok:
			return grokModels
		case ApiProvider.Ollama:
			return {}
		case ApiProvider.OpenAICompatible:
			return {}
		default:
			return {}
	}
}

// Get all model ids for a provider
export const GetProviderModelIds = async (provider: ApiProvider, settings?: InfioSettings): Promise<string[]> => {
	const models = await GetProviderModels(provider, settings)
	return Object.keys(models)
}

/// Embedding models

// Get all embedding models for a provider
export const GetEmbeddingProviderModels = (provider: ApiProvider): Record<string, EmbeddingModelInfo> => {
	switch (provider) {
		case ApiProvider.Infio:
			return infioEmbeddingModels
		case ApiProvider.Google:
			return geminiEmbeddingModels
		case ApiProvider.SiliconFlow:
			return siliconFlowEmbeddingModels
		case ApiProvider.OpenAI:
			return openAINativeEmbeddingModels;
		case ApiProvider.AlibabaQwen:
			return qwenEmbeddingModels;
		default:
			return {}
	}
}
// Get all embedding model ids for a provider
export const GetEmbeddingProviderModelIds = (provider: ApiProvider): string[] => {
	return Object.keys(GetEmbeddingProviderModels(provider))
}
// Get embedding model info for a provider and model id
export const GetEmbeddingModelInfo = (provider: ApiProvider, modelId: string): EmbeddingModelInfo => {
	const models = GetEmbeddingProviderModels(provider)
	return models[modelId]
}

// Get default model id for a provider
export const GetDefaultModelId = (provider: ApiProvider): { chat: string, autoComplete: string, embedding: string } => {
	switch (provider) {
		case ApiProvider.Infio:
			return {
				"chat": infioDefaultModelId,
				"autoComplete": infioDefaultAutoCompleteModelId,
				"embedding": infioDefaultEmbeddingModelId,
			}
		case ApiProvider.OpenRouter:
			return {
				"chat": openRouterDefaultModelId,
				"autoComplete": openRouterDefaultAutoCompleteModelId,
				"embedding": openRouterDefaultEmbeddingModelId,
			}
		case ApiProvider.Anthropic:
			return {
				"chat": anthropicDefaultModelId,
				"autoComplete": anthropicDefaultAutoCompleteModelId,
				"embedding": anthropicDefaultEmbeddingModelId,
			}
		case ApiProvider.OpenAI:
			return {
				"chat": openAiNativeDefaultModelId,
				"autoComplete": openAiNativeDefaultAutoCompleteModelId,
				"embedding": openAiNativeDefaultEmbeddingModelId,
			}
		case ApiProvider.Deepseek:
			return {
				"chat": deepSeekDefaultModelId,
				"autoComplete": deepSeekDefaultAutoCompleteModelId,
				"embedding": deepSeekDefaultEmbeddingModelId,
			}
		case ApiProvider.Google:
			return {
				"chat": geminiDefaultModelId,
				"autoComplete": geminiDefaultAutoCompleteModelId,
				"embedding": geminiDefaultEmbeddingModelId,
			}
		case ApiProvider.AlibabaQwen:
			return {
				"chat": qwenDefaultModelId,
				"autoComplete": qwenDefaultAutoCompleteModelId,
				"embedding": qwenDefaultEmbeddingModelId,
			}
		case ApiProvider.SiliconFlow:
			return {
				"chat": siliconFlowDefaultModelId,
				"autoComplete": siliconFlowDefaultAutoCompleteModelId,
				"embedding": siliconFlowDefaultEmbeddingModelId,
			}
		case ApiProvider.Groq:
			return {
				"chat": groqDefaultModelId,
				"autoComplete": groqDefaultAutoCompleteModelId,
				"embedding": groqDefaultEmbeddingModelId,
			}
		case ApiProvider.Grok:
			return {
				"chat": grokDefaultModelId,
				"autoComplete": grokDefaultAutoCompleteModelId,
				"embedding": grokDefaultEmbeddingModelId,
			}
		default:
			return {
				"chat": null,
				"autoComplete": null,
				"embedding": null,
			}
	}
}
