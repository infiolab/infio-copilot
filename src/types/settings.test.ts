import { DEFAULT_MODELS } from '../constants'
import { DEFAULT_AUTOCOMPLETE_SETTINGS } from '../settings/versions/v1/v1'

import { SETTINGS_SCHEMA_VERSION, parseInfioSettings } from './settings'

describe('parseSmartCopilotSettings', () => {
	it('should return default values for empty input', () => {
		const result = parseInfioSettings({})
		expect(result).toEqual({
			version: 0.1,
			activeModels: DEFAULT_MODELS,
			infioApiKey: '',
			openAIApiKey: '',
			anthropicApiKey: '',
			geminiApiKey: '',
			groqApiKey: '',
			deepseekApiKey: '',
			chatModelId: 'deepseek-chat',
			ollamaChatModel: {
				baseUrl: '',
				model: '',
			},
			openAICompatibleChatModel: {
				baseUrl: '',
				apiKey: '',
				model: '',
			},
			applyModelId: 'deepseek-chat',
			ollamaApplyModel: {
				baseUrl: '',
				model: '',
			},
			openAICompatibleApplyModel: {
				baseUrl: '',
				apiKey: '',
				model: '',
			},
			embeddingModelId: 'text-embedding-004',
			ollamaEmbeddingModel: {
				baseUrl: '',
				model: '',
			},
			systemPrompt: '',
			ragOptions: {
				chunkSize: 1000,
				thresholdTokens: 8192,
				minSimilarity: 0.0,
				limit: 10,
				excludePatterns: [],
				includePatterns: [],
			},
			autocompleteEnabled: true,
			advancedMode: false,
			apiProvider: 'openai',
			azureOAIApiSettings: '',
			openAIApiSettings: '',
			ollamaApiSettings: '',
			triggers: DEFAULT_AUTOCOMPLETE_SETTINGS.triggers,
			delay: 500,
			modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 800,
			},
			systemMessage: DEFAULT_AUTOCOMPLETE_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_AUTOCOMPLETE_SETTINGS.fewShotExamples,
			userMessageTemplate: '{{prefix}}<mask/>{{suffix}}',
			chainOfThoughRemovalRegex: '(.|\\n)*ANSWER:',
			dontIncludeDataviews: true,
			maxPrefixCharLimit: 4000,
			maxSuffixCharLimit: 4000,
			removeDuplicateMathBlockIndicator: true,
			removeDuplicateCodeBlockIndicator: true,
			ignoredFilePatterns: '**/secret/**\n',
			ignoredTags: '',
			cacheSuggestions: true,
			debugMode: false,
		})
	})
})

describe('settings migration', () => {
	it('should migrate from v0 to v1', () => {
		const oldSettings = {
			openAIApiKey: 'openai-api-key',
			groqApiKey: 'groq-api-key',
			anthropicApiKey: 'anthropic-api-key',
			ollamaBaseUrl: 'http://localhost:11434',
			chatModel: 'claude-3.5-sonnet-latest',
			applyModel: 'gpt-4o-mini',
			embeddingModel: 'text-embedding-3-small',
			systemPrompt: 'system prompt',
			ragOptions: {
				chunkSize: 1000,
				thresholdTokens: 8192,
				minSimilarity: 0.0,
				limit: 10,
			},
		}

		const result = parseInfioSettings(oldSettings)
		expect(result).toEqual({
			version: 0.1,
			activeModels: DEFAULT_MODELS,
			infioApiKey: '',
			openAIApiKey: '',
			anthropicApiKey: '',
			geminiApiKey: '',
			groqApiKey: '',
			deepseekApiKey: '',
			chatModelId: 'deepseek-chat',
			ollamaChatModel: {
				baseUrl: '',
				model: '',
			},
			openAICompatibleChatModel: {
				baseUrl: '',
				apiKey: '',
				model: '',
			},
			applyModelId: 'deepseek-chat',
			ollamaApplyModel: {
				baseUrl: '',
				model: '',
			},
			openAICompatibleApplyModel: {
				baseUrl: '',
				apiKey: '',
				model: '',
			},
			embeddingModelId: 'text-embedding-004',
			ollamaEmbeddingModel: {
				baseUrl: '',
				model: '',
			},
			systemPrompt: '',
			ragOptions: {
				chunkSize: 1000,
				thresholdTokens: 8192,
				minSimilarity: 0.0,
				limit: 10,
				excludePatterns: [],
				includePatterns: [],
			},
			autocompleteEnabled: true,
			advancedMode: false,
			apiProvider: 'openai',
			azureOAIApiSettings: '',
			openAIApiSettings: '',
			ollamaApiSettings: '',
			triggers: DEFAULT_AUTOCOMPLETE_SETTINGS.triggers,
			delay: 500,
			modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 800,
			},
			systemMessage: DEFAULT_AUTOCOMPLETE_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_AUTOCOMPLETE_SETTINGS.fewShotExamples,
			userMessageTemplate: '{{prefix}}<mask/>{{suffix}}',
			chainOfThoughRemovalRegex: '(.|\\n)*ANSWER:',
			dontIncludeDataviews: true,
			maxPrefixCharLimit: 4000,
			maxSuffixCharLimit: 4000,
			removeDuplicateMathBlockIndicator: true,
			removeDuplicateCodeBlockIndicator: true,
			ignoredFilePatterns: '**/secret/**\n',
			ignoredTags: '',
			cacheSuggestions: true,
			debugMode: false,
		})
	})
})
