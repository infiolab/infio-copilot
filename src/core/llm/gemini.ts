import {
	Content,
	GoogleGenAI,
	type GenerateContentConfig,
	type GenerateContentParameters,
	type GenerateContentResponse,
} from "@google/genai"

import { ApiProvider, LLMModel } from '../../types/llm/model'
import {
	LLMOptions,
	LLMRequestNonStreaming,
	LLMRequestStreaming,
	RequestMessage,
} from '../../types/llm/request'
import {
	LLMResponseNonStreaming,
	LLMResponseStreaming,
} from '../../types/llm/response'
import {
	GetProviderModels,
	ModelInfo
} from "../../utils/api"
import { parseImageDataUrl } from '../../utils/image'

import { BaseLLMProvider } from './base'
import {
	LLMAPIKeyInvalidException,
	LLMAPIKeyNotSetException,
} from './exception'

/**
 * Note on OpenAI Compatibility API:
 * Gemini provides an OpenAI-compatible endpoint (https://ai.google.dev/gemini-api/docs/openai)
 * which allows using the OpenAI SDK with Gemini models. However, there are currently CORS issues
 * preventing its use in Obsidian. Consider switching to this endpoint in the future once these
 * issues are resolved.
 */
export class GeminiProvider implements BaseLLMProvider {
	private client: GoogleGenAI
	private apiKey: string
	private baseUrl?: string
	private dynamicModels: Record<string, ModelInfo> | null = null

	constructor(apiKey: string, baseUrl?: string) {
		this.apiKey = apiKey
		this.baseUrl = baseUrl
		this.client = new GoogleGenAI({ apiKey })
	}

	// 获取动态模型列表（带缓存）
	private async getDynamicModels(): Promise<Record<string, ModelInfo>> {
		if (this.dynamicModels) {
			return this.dynamicModels
		}

		try {
			// 使用 GetProviderModels 来获取动态模型
			const settings = {
				googleProvider: {
					apiKey: this.apiKey,
					baseUrl: this.baseUrl,
					useCustomUrl: !!this.baseUrl
				}
			}
			this.dynamicModels = await GetProviderModels(ApiProvider.Google, settings)
			return this.dynamicModels
		} catch (error) {
			console.warn('Failed to fetch dynamic Gemini models:', error)
			return {}
		}
	}

	async getModel(modelId: string) {
		const id = modelId
		
		// 只从动态模型中查找
		const dynamicModels = await this.getDynamicModels()
		const info = dynamicModels[id]

		// 如果没找到模型，抛出错误
		if (!info) {
			throw new Error(`Model ${modelId} not found in available Gemini models. Please check your model configuration.`)
		}

		// 检查模型是否支持 thinking
		if (info.thinking === true) {
			return {
				id,
				info,
				thinkingConfig: {
					includeThoughts: true,
					thinkingBudget: -1  // -1 表示自动分配思考预算
				},
				maxOutputTokens: info.maxTokens ?? undefined,
			}
		}

		return { id, info }
	}

	async generateResponse(
		model: LLMModel,
		request: LLMRequestNonStreaming,
		options?: LLMOptions,
	): Promise<LLMResponseNonStreaming> {
		if (!this.apiKey) {
			throw new LLMAPIKeyNotSetException(
				`Gemini API key is missing. Please set it in settings menu.`,
			)
		}

		const { id: modelName, thinkingConfig, maxOutputTokens } = await this.getModel(model.modelId)

		const systemMessages = request.messages.filter((m) => m.role === 'system')
		const systemInstruction: string | undefined =
			systemMessages.length > 0
				? systemMessages.map((m) => m.content).join('\n')
				: undefined

		try {

			const config: GenerateContentConfig = {
				systemInstruction,
				httpOptions: this.baseUrl ? { baseUrl: this.baseUrl } : undefined,
				thinkingConfig,
				maxOutputTokens: maxOutputTokens ?? request.max_tokens,
				temperature: request.temperature ?? 0,
				topP: request.top_p ?? 1,
				presencePenalty: request.presence_penalty ?? 0,
				frequencyPenalty: request.frequency_penalty ?? 0,
			}
			const params: GenerateContentParameters = {
				model: modelName,
				contents: request.messages
					.map((message) => GeminiProvider.parseRequestMessage(message))
					.filter((m): m is Content => m !== null),
				config,
			}

			const result = await this.client.models.generateContent(params)
			const messageId = crypto.randomUUID() // Gemini does not return a message id
			return GeminiProvider.parseNonStreamingResponse(
				result,
				request.model,
				messageId,
			)
		} catch (error) {
			const isInvalidApiKey =
				error.message?.includes('API_KEY_INVALID') ||
				error.message?.includes('API key not valid')

			if (isInvalidApiKey) {
				throw new LLMAPIKeyInvalidException(
					`Gemini API key is invalid. Please update it in settings menu.`,
				)
			}

			throw error
		}
	}

	async streamResponse(
		model: LLMModel,
		request: LLMRequestStreaming,
		options?: LLMOptions,
	): Promise<AsyncIterable<LLMResponseStreaming>> {
		if (!this.apiKey) {
			throw new LLMAPIKeyNotSetException(
				`Gemini API key is missing. Please set it in settings menu.`,
			)
		}
		const { id: modelName, thinkingConfig, maxOutputTokens } = await this.getModel(model.modelId)

		const systemMessages = request.messages.filter((m) => m.role === 'system')
		const systemInstruction: string | undefined =
			systemMessages.length > 0
				? systemMessages.map((m) => m.content).join('\n')
				: undefined

		try {
			const config: GenerateContentConfig = {
				systemInstruction,
				httpOptions: this.baseUrl ? { baseUrl: this.baseUrl } : undefined,
				thinkingConfig,
				maxOutputTokens: maxOutputTokens ?? request.max_tokens,
				temperature: request.temperature ?? 0,
				topP: request.top_p ?? 1,
				presencePenalty: request.presence_penalty ?? 0,
				frequencyPenalty: request.frequency_penalty ?? 0,
			}
			const params: GenerateContentParameters = {
				model: modelName,
				contents: request.messages
					.map((message) => GeminiProvider.parseRequestMessage(message))
					.filter((m): m is Content => m !== null),
				config,
			}

			const stream = await this.client.models.generateContentStream(params)
			const messageId = crypto.randomUUID() // Gemini does not return a message id
			return this.streamResponseGenerator(stream, request.model, messageId)
		} catch (error) {
			const isInvalidApiKey =
				error.message?.includes('API_KEY_INVALID') ||
				error.message?.includes('API key not valid')

			if (isInvalidApiKey) {
				throw new LLMAPIKeyInvalidException(
					`Gemini API key is invalid. Please update it in settings menu.`,
				)
			}

			throw error
		}
	}

	private async *streamResponseGenerator(
		stream: AsyncGenerator<GenerateContentResponse>,
		model: string,
		messageId: string,
	): AsyncIterable<LLMResponseStreaming> {
		for await (const chunk of stream) {
			yield GeminiProvider.parseStreamingResponseChunk(chunk, model, messageId)
		}
	}

	static parseRequestMessage(message: RequestMessage): Content | null {
		if (message.role === 'system') {
			return null
		}

		if (Array.isArray(message.content)) {
			return {
				role: message.role === 'user' ? 'user' : 'model',
				parts: message.content.map((part) => {
					switch (part.type) {
						case 'text':
							return { text: part.text }
						case 'image_url': {
							const { mimeType, base64Data } = parseImageDataUrl(
								part.image_url.url,
							)
							GeminiProvider.validateImageType(mimeType)

							return {
								inlineData: {
									data: base64Data,
									mimeType,
								},
							}
						}
						default:
							throw new Error(`Unsupported content type`)
					}
				}),
			}
		}

		return {
			role: message.role === 'user' ? 'user' : 'model',
			parts: [
				{
					text: message.content,
				},
			],
		}
	}

	static parseNonStreamingResponse(
		response: GenerateContentResponse,
		model: string,
		messageId: string,
	): LLMResponseNonStreaming {
		const firstCandidate = response.candidates?.[0]
		const parts = firstCandidate?.content?.parts || []
		
		// 分离思考内容和实际回复内容
		let reasoningContent = ''
		let actualContent = ''
		
		for (const part of parts) {
			if (part.text) {
				// 检查是否是思考内容（带有 thought: true 标记）
				if ('thought' in part && part.thought === true) {
					reasoningContent += part.text
				} else {
					// 实际回复内容
					actualContent += part.text
				}
			}
		}
		
		return {
			id: messageId,
			choices: [
				{
					finish_reason: firstCandidate?.finishReason ?? null,
					message: {
						content: actualContent,
						reasoning_content: reasoningContent || null,
						role: 'assistant',
					},
				},
			],
			created: Date.now(),
			model: model,
			object: 'chat.completion',
			usage: response.usageMetadata
				? {
					prompt_tokens: response.usageMetadata.promptTokenCount,
					completion_tokens:
						response.usageMetadata.candidatesTokenCount,
					total_tokens: response.usageMetadata.totalTokenCount,
				}
				: undefined,
		}
	}

	static parseStreamingResponseChunk(
		chunk: GenerateContentResponse,
		model: string,
		messageId: string,
	): LLMResponseStreaming {
		const firstCandidate = chunk.candidates?.[0]
		const parts = firstCandidate?.content?.parts || []
		
		// 分离思考内容和实际回复内容
		let reasoningContent = ''
		let actualContent = ''
		
		for (const part of parts) {
			if (part.text) {
				// 检查是否是思考内容（带有 thought: true 标记）
				if ('thought' in part && part.thought === true) {
					reasoningContent += part.text
				} else {
					// 实际回复内容
					actualContent += part.text
				}
			}
		}
		
		return {
			id: messageId,
			choices: [
				{
					finish_reason: firstCandidate?.finishReason ?? null,
					delta: {
						content: actualContent,
						reasoning_content: reasoningContent || null,
					},
				},
			],
			created: Date.now(),
			model: model,
			object: 'chat.completion.chunk',
			usage: chunk.usageMetadata
				? {
					prompt_tokens: chunk.usageMetadata.promptTokenCount,
					completion_tokens: chunk.usageMetadata.candidatesTokenCount,
					total_tokens: chunk.usageMetadata.totalTokenCount,
				}
				: undefined,
		}
	}

	private static validateImageType(mimeType: string) {
		const SUPPORTED_IMAGE_TYPES = [
			'image/png',
			'image/jpeg',
			'image/webp',
			'image/heic',
			'image/heif',
		]
		if (!SUPPORTED_IMAGE_TYPES.includes(mimeType)) {
			throw new Error(
				`Gemini does not support image type ${mimeType}. Supported types: ${SUPPORTED_IMAGE_TYPES.join(
					', ',
				)}`,
			)
		}
	}
}
