import { LLMModel } from './types/llm/model'
// import { ApiProvider } from './utils/api'
export const CHAT_VIEW_TYPE = 'infio-chat-view'
export const APPLY_VIEW_TYPE = 'infio-apply-view'
export const PREVIEW_VIEW_TYPE = 'infio-preview-view'
export const JSON_VIEW_TYPE = 'infio-json-view'

export const DEFAULT_MODELS: LLMModel[] = []

export const SUPPORT_EMBEDDING_SIMENTION: number[] = [
	384,
	512,
	768,
	1024,
	1536
]

export const OPENAI_BASE_URL = 'https://api.openai.com/v1'
export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com'
export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
export const GROK_BASE_URL = 'https://api.x.ai/v1'
export const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1'
export const ALIBABA_QWEN_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'
export const MOONSHOT_BASE_URL = 'https://api.moonshot.cn/v1'
export const ZHIPUAI_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4'
export const INFIO_BASE_URL = 'https://api.infio.app'
export const INFIO_PLATFORM_URL = 'https://platform.infio.app'
export const JINA_BASE_URL = 'https://r.jina.ai'
export const SERPER_BASE_URL = 'https://serpapi.com/search'
// Pricing in dollars per million tokens
type ModelPricing = {
	input: number
	output: number
}

export const OPENAI_PRICES: Record<string, ModelPricing> = {
	'gpt-4o': { input: 2.5, output: 10 },
	'gpt-4o-mini': { input: 0.15, output: 0.6 },
	'deepseek-chat': { input: 0.16, output: 0.32 },
}

export const ANTHROPIC_PRICES: Record<string, ModelPricing> = {
	'claude-3-5-sonnet-latest': { input: 3, output: 15 },
	'claude-3-5-haiku-latest': { input: 1, output: 5 },
}

// Gemini is currently free for low rate limits
export const GEMINI_PRICES: Record<string, ModelPricing> = {
	'gemini-1.5-pro': { input: 0, output: 0 },
	'gemini-1.5-flash': { input: 0, output: 0 },
}

export const GROQ_PRICES: Record<string, ModelPricing> = {
	'llama-3.1-70b-versatile': { input: 0.59, output: 0.79 },
	'llama-3.1-8b-instant': { input: 0.05, output: 0.08 },
}

export const PGLITE_DB_PATH = '.infio_pglite_db.tar.gz'
