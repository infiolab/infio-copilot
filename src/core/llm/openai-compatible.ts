import OpenAI from 'openai'

import { ALIBABA_QWEN_BASE_URL, INFIO_BASE_URL, MOONSHOT_BASE_URL } from '../../constants'
import { LLMModel } from '../../types/llm/model'
import {
  LLMOptions,
  LLMRequestNonStreaming,
  LLMRequestStreaming,
} from '../../types/llm/request'
import {
  LLMResponseNonStreaming,
  LLMResponseStreaming,
} from '../../types/llm/response'

import { BaseLLMProvider } from './base'
import { LLMBaseUrlNotSetException } from './exception'
import { NoStainlessOpenAI } from './ollama'
import { OpenAIMessageAdapter } from './openai-message-adapter'

export class OpenAICompatibleProvider implements BaseLLMProvider {
  private adapter: OpenAIMessageAdapter
  private client: OpenAI | NoStainlessOpenAI
  private apiKey: string
  private baseURL: string

  constructor(apiKey: string, baseURL: string) {
    this.adapter = new OpenAIMessageAdapter()
    this.apiKey = apiKey
    this.baseURL = baseURL
    
    // 判断是否需要使用 NoStainlessOpenAI 来解决 CORS 问题
    const needsCorsAdapter = baseURL === MOONSHOT_BASE_URL || 
                           baseURL?.includes('api.moonshot.cn')
    
    if (needsCorsAdapter) {
      this.client = new NoStainlessOpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
      })
    } else {
      this.client = new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL,
        dangerouslyAllowBrowser: true,
      })
    }
	}
	
	// check Model is Reasoning Model
	private isReasoning(modelName: string): boolean {
		try {
			if (!modelName) {
				return false
			}

			if (this.baseURL !== INFIO_BASE_URL) {
				return false
			}

			if (modelName.includes('gemini-2.5')) {
				return true
			}
			if (modelName.includes('agent-')) {
				return true
			}
			return false
		} catch (e) {
			console.error(e)
		}
		return false
	}

  // 检查是否为阿里云Qwen API
  private isAlibabaQwen(): boolean {
    return this.baseURL === ALIBABA_QWEN_BASE_URL || 
           this.baseURL?.includes('dashscope.aliyuncs.com')
	}

	private isInfio(): boolean {
		return this.baseURL === INFIO_BASE_URL
	}

  // 获取提供商特定的额外参数
  private getExtraParams(isStreaming: boolean, modelName: string): Record<string, unknown> {
    const extraParams: Record<string, unknown> = {}
    
    // 阿里云Qwen API需要在非流式调用中设置 enable_thinking: false
    if (this.isAlibabaQwen() && !isStreaming) {
      extraParams.enable_thinking = false
		}    
		if (this.isReasoning(modelName)) {
			extraParams.reasoning_effort = 'low';
		}

    return extraParams
  }

  async generateResponse(
    model: LLMModel,
    request: LLMRequestNonStreaming,
    options?: LLMOptions,
  ): Promise<LLMResponseNonStreaming> {
    if (!this.baseURL || !this.apiKey) {
      throw new LLMBaseUrlNotSetException(
        'OpenAI Compatible base URL or API key is missing. Please set it in settings menu.',
      )
    }

    const extraParams = this.getExtraParams(false, model.modelId) // 非流式调用
    return this.adapter.generateResponse(this.client as OpenAI, request, options, extraParams)
  }

  async streamResponse(
    model: LLMModel,
    request: LLMRequestStreaming,
    options?: LLMOptions,
  ): Promise<AsyncIterable<LLMResponseStreaming>> {
    if (!this.baseURL || !this.apiKey) {
      throw new LLMBaseUrlNotSetException(
        'OpenAI Compatible base URL or API key is missing. Please set it in settings menu.',
      )
		}
    const extraParams = this.getExtraParams(true, model.modelId)

    return this.adapter.streamResponse(this.client as OpenAI, request, options, extraParams)
  }
}
