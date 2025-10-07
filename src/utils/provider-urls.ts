import { ApiProvider } from '../types/llm/model';

// Provider API Key获取地址映射
export const providerApiUrls: Record<ApiProvider, string> = {
	[ApiProvider.Infio]: 'https://platform.infio.app/api-keys',
	[ApiProvider.OpenRouter]: 'https://openrouter.ai/settings/keys',
	[ApiProvider.SiliconFlow]: 'https://cloud.siliconflow.cn/account/ak',
	[ApiProvider.AlibabaQwen]: 'https://help.aliyun.com/zh/dashscope/developer-reference/activate-dashscope-and-create-an-api-key',
	[ApiProvider.Anthropic]: 'https://console.anthropic.com/settings/keys',
	[ApiProvider.Deepseek]: 'https://platform.deepseek.com/api_keys/',
	[ApiProvider.OpenAI]: 'https://platform.openai.com/api-keys',
	[ApiProvider.Google]: 'https://aistudio.google.com/apikey',
	[ApiProvider.Groq]: 'https://console.groq.com/keys',
	[ApiProvider.Grok]: 'https://console.x.ai/',
	[ApiProvider.Moonshot]: 'https://platform.moonshot.cn/console/api-keys',
	[ApiProvider.ZhipuAI]: 'https://open.bigmodel.cn/usercenter/apikeys',
	[ApiProvider.Ollama]: '', // Ollama 不需要API Key
	[ApiProvider.OpenAICompatible]: '', // 自定义兼容API，无固定URL
	[ApiProvider.LocalProvider]: '', // 本地提供者，无固定URL
};

// 获取指定provider的API Key获取URL
export function getProviderApiUrl(provider: ApiProvider): string {
	return providerApiUrls[provider] || '';
} 
