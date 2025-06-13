import https from 'https'
import { URL } from 'url'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { OpenAI } from 'openai'

import { ALIBABA_QWEN_BASE_URL, INFIO_BASE_URL, OPENAI_BASE_URL, SILICONFLOW_BASE_URL } from "../../constants"
import { EmbeddingModel } from '../../types/embedding'
import { ApiProvider } from '../../types/llm/model'
import { InfioSettings } from '../../types/settings'
import { GetEmbeddingModelInfo } from '../../utils/api'
import {
	LLMAPIKeyNotSetException,
	LLMBaseUrlNotSetException,
	LLMRateLimitExceededException,
} from '../llm/exception'
import { NoStainlessOpenAI } from '../llm/ollama'

export const getEmbeddingModel = (
	settings: InfioSettings,
): EmbeddingModel => {
	switch (settings.embeddingModelProvider) {
		case ApiProvider.Infio: {
			const openai = new OpenAI({
				apiKey: settings.infioProvider.apiKey,
				baseURL: INFIO_BASE_URL,
				dangerouslyAllowBrowser: true,
			})
			const modelInfo = GetEmbeddingModelInfo(settings.embeddingModelProvider, settings.embeddingModelId)
			return {
				id: settings.embeddingModelId,
				dimension: modelInfo.dimensions,
				supportsBatch: true,
				getEmbedding: async (text: string) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'OpenAI API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: text,
						})
						return embedding.data[0].embedding
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'OpenAI API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
				getBatchEmbeddings: async (texts: string[]) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'OpenAI API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: texts,
						})
						return embedding.data.map(item => item.embedding)
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'OpenAI API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
			}
		}
		case ApiProvider.OpenAI: {
			const baseURL = settings.openaiProvider.useCustomUrl ? settings.openaiProvider.baseUrl : OPENAI_BASE_URL
			const openai = new OpenAI({
				apiKey: settings.openaiProvider.apiKey,
				baseURL: baseURL,
				dangerouslyAllowBrowser: true,
			})
			const modelInfo = GetEmbeddingModelInfo(settings.embeddingModelProvider, settings.embeddingModelId)
			return {
				id: settings.embeddingModelId,
				dimension: modelInfo.dimensions,
				supportsBatch: true,
				getEmbedding: async (text: string) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'OpenAI API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: text,
						})
						return embedding.data[0].embedding
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'OpenAI API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
				getBatchEmbeddings: async (texts: string[]) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'OpenAI API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: texts,
						})
						return embedding.data.map(item => item.embedding)
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'OpenAI API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
			}
		}
		case ApiProvider.SiliconFlow: {
			const baseURL = settings.siliconflowProvider.useCustomUrl ? settings.siliconflowProvider.baseUrl : SILICONFLOW_BASE_URL
			const openai = new OpenAI({
				apiKey: settings.siliconflowProvider.apiKey,
				baseURL: baseURL,
				dangerouslyAllowBrowser: true,
			})
			const modelInfo = GetEmbeddingModelInfo(settings.embeddingModelProvider, settings.embeddingModelId)
			return {
				id: settings.embeddingModelId,
				dimension: modelInfo.dimensions,
				supportsBatch: true,
				getEmbedding: async (text: string) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'SiliconFlow API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: text,
						})
						return embedding.data[0].embedding
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'SiliconFlow API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
				getBatchEmbeddings: async (texts: string[]) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'SiliconFlow API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: texts,
						})
						return embedding.data.map(item => item.embedding)
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'SiliconFlow API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
			}
		}
		case ApiProvider.AlibabaQwen: {
			const baseURL = settings.alibabaQwenProvider.useCustomUrl ? settings.alibabaQwenProvider.baseUrl : ALIBABA_QWEN_BASE_URL
			const openai = new OpenAI({
				apiKey: settings.alibabaQwenProvider.apiKey,
				baseURL: baseURL,
				dangerouslyAllowBrowser: true,
			})
			const modelInfo = GetEmbeddingModelInfo(settings.embeddingModelProvider, settings.embeddingModelId)
			return {
				id: settings.embeddingModelId,
				dimension: modelInfo.dimensions,
				supportsBatch: false,
				getEmbedding: async (text: string) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'Alibaba Qwen API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: text,
						})
						return embedding.data[0].embedding
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'Alibaba Qwen API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
				getBatchEmbeddings: async (texts: string[]) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'Alibaba Qwen API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: texts,
						})
						return embedding.data.map(item => item.embedding)
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'Alibaba Qwen API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
			}
		}
		case ApiProvider.Google: {
			const client = new GoogleGenerativeAI(settings.googleProvider.apiKey)
			const model = client.getGenerativeModel({ model: settings.embeddingModelId })
			const modelInfo = GetEmbeddingModelInfo(settings.embeddingModelProvider, settings.embeddingModelId)
			return {
				id: settings.embeddingModelId,
				dimension: modelInfo.dimensions,
				supportsBatch: false,
				getEmbedding: async (text: string) => {
					try {
						const response = await model.embedContent(text)
						return response.embedding.values
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.includes('RATE_LIMIT_EXCEEDED')
						) {
							throw new LLMRateLimitExceededException(
								'Gemini API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
				getBatchEmbeddings: async (texts: string[]) => {
					try {
						const embeddings = await Promise.all(
							texts.map(async (text) => {
								const response = await model.embedContent(text)
								return response.embedding.values
							})
						)
						return embeddings
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.includes('RATE_LIMIT_EXCEEDED')
						) {
							throw new LLMRateLimitExceededException(
								'Gemini API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
			}
		}
		case ApiProvider.Ollama: {
			const openai = new NoStainlessOpenAI({
				apiKey: settings.ollamaProvider.apiKey,
				dangerouslyAllowBrowser: true,
				baseURL: `${settings.ollamaProvider.baseUrl}/v1`,
			})
			return {
				id: settings.embeddingModelId,
				dimension: 0,
				supportsBatch: false,
				getEmbedding: async (text: string) => {
					if (!settings.ollamaProvider.baseUrl) {
						throw new LLMBaseUrlNotSetException(
							'Ollama Address is missing. Please set it in settings menu.',
						)
					}
					const embedding = await openai.embeddings.create({
						model: settings.embeddingModelId,
						input: text,
					})
					return embedding.data[0].embedding
				},
				getBatchEmbeddings: async (texts: string[]) => {
					if (!settings.ollamaProvider.baseUrl) {
						throw new LLMBaseUrlNotSetException(
							'Ollama Address is missing. Please set it in settings menu.',
						)
					}
					const embedding = await openai.embeddings.create({
						model: settings.embeddingModelId,
						input: texts,
					})
					return embedding.data.map(item => item.embedding)
				},
			}
		}
		case ApiProvider.OpenAICompatible: {
			const openai = new OpenAI({
				apiKey: settings.openaicompatibleProvider.apiKey,
				baseURL: settings.openaicompatibleProvider.baseUrl,
				dangerouslyAllowBrowser: true,
			});
			return {
				id: settings.embeddingModelId,
				dimension: 0,
				supportsBatch: false,
				getEmbedding: async (text: string) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'OpenAI Compatible API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: text,
							encoding_format: "float",
						})
						return embedding.data[0].embedding
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'OpenAI Compatible API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
				getBatchEmbeddings: async (texts: string[]) => {
					try {
						if (!openai.apiKey) {
							throw new LLMAPIKeyNotSetException(
								'OpenAI Compatible API key is missing. Please set it in settings menu.',
							)
						}
						const embedding = await openai.embeddings.create({
							model: settings.embeddingModelId,
							input: texts,
							encoding_format: "float",
						})
						return embedding.data.map(item => item.embedding)
					} catch (error) {
						if (
							error.status === 429 &&
							error.message.toLowerCase().includes('rate limit')
						) {
							throw new LLMRateLimitExceededException(
								'OpenAI Compatible API rate limit exceeded. Please try again later.',
							)
						}
						throw error
					}
				},
			}
		}
		default:
			throw new Error('Invalid embedding model')
	}
}
