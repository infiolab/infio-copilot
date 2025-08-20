export enum ApiProvider {
	Infio = "Infio",
	OpenRouter = "OpenRouter",
	SiliconFlow = "SiliconFlow",
	AlibabaQwen = "AlibabaQwen",
	Anthropic = "Anthropic",
	Deepseek = "Deepseek",
	OpenAI = "OpenAI",
	Google = "Google",
	Groq = "Groq",
	Grok = "Grok",
	Moonshot = "Moonshot",
	ZhipuAI = "ZhipuAI",
	Ollama = "Ollama",
	OpenAICompatible = "OpenAICompatible",
	LocalProvider = "LocalProvider",
}

export type LLMModel = {
	provider: ApiProvider;
	modelId: string;
}

// Model Providers
export enum ModelProviders {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
  GOOGLE = "google",
  GROQ = "groq",
  deepseek = "deepseek",
  Ollama = "ollama",
}

export type CustomLLMModel = {
  name: string;
  provider: string;
  baseUrl?: string;
  apiKey?: string;
  enabled: boolean;
  isEmbeddingModel: boolean;
  isBuiltIn: boolean;
  dimension?: number;
}
