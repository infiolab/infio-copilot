import OpenAI from 'openai'

import { ALIBABA_QWEN_BASE_URL } from '../../constants'
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
import { OpenAIMessageAdapter } from './openai-message-adapter'

export class OpenAICompatibleProvider implements BaseLLMProvider {
  private adapter: OpenAIMessageAdapter
  private client: OpenAI
  private apiKey: string
  private baseURL: string

  constructor(apiKey: string, baseURL: string) {
		this.adapter = new OpenAIMessageAdapter()
    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: baseURL,
      dangerouslyAllowBrowser: true,
    })
    this.apiKey = apiKey
    this.baseURL = baseURL
  }

  // 检查是否为阿里云Qwen API
  private isAlibabaQwen(): boolean {
    return this.baseURL === ALIBABA_QWEN_BASE_URL || 
           this.baseURL?.includes('dashscope.aliyuncs.com')
  }

  // 获取提供商特定的额外参数
  private getExtraParams(isStreaming: boolean): Record<string, any> {
    const extraParams: Record<string, any> = {}
    
    // 阿里云Qwen API需要在非流式调用中设置 enable_thinking: false
    if (this.isAlibabaQwen() && !isStreaming) {
      extraParams.enable_thinking = false
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

    const extraParams = this.getExtraParams(false) // 非流式调用
    return this.adapter.generateResponse(this.client, request, options, extraParams)
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

    const extraParams = this.getExtraParams(true) // 流式调用
    return this.adapter.streamResponse(this.client, request, options, extraParams)
  }
}
