import { DEFAULT_MODELS } from '../constants'
import { DEFAULT_SETTINGS } from '../settings/versions/v1/v1'

import { parseInfioSettings, SETTINGS_SCHEMA_VERSION } from './settings'

describe('parseSmartCopilotSettings', () => {
	it('should return default values for empty input', () => {
		const result = parseInfioSettings({})
		expect(result).toEqual({
      // Version
			version: SETTINGS_SCHEMA_VERSION,
      // Provider
      defaultProvider: 'Infio',
      infioProvider: {
				name: 'Infio',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      openrouterProvider: {
				name: 'OpenRouter',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			siliconflowProvider: {
				name: 'SiliconFlow',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      alibabaQwenProvider: {
				name: 'AlibabaQwen',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			anthropicProvider: {
				name: 'Anthropic',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      deepseekProvider: {
				name: 'DeepSeek',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      openaiProvider: {
				name: 'OpenAI',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			googleProvider: {
				name: 'Google',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      ollamaProvider: {
				apiKey: 'ollama',
				baseUrl: '',
				name: 'Ollama',
				useCustomUrl: true,
			},
			groqProvider: {
				name: 'Groq',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			grokProvider: {
				name: 'Grok',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			openaicompatibleProvider: {
				name: 'OpenAICompatible',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: true,
			},
      // MCP Servers
      mcpEnabled: false,
      // Chat Model start list
      collectedChatModels: [],
      // Active Provider Tab (for UI state)
			activeProviderTab: 'Infio',
      // Chat Model
      chatModelProvider: 'Infio',
			chatModelId: '',
      // Apply Model
      applyModelProvider: 'Infio',
      applyModelId: '',
      // Embedding Model
      embeddingModelProvider: 'Infio',
      embeddingModelId: '',
      // Fuzzy Match Threshold
      fuzzyMatchThreshold: 0.85,
      // Experimental Diff Strategy
      experimentalDiffStrategy: false,
      // Multi Search Replace Diff Strategy
      multiSearchReplaceDiffStrategy: true,
      // Mode
      mode: 'ask',
			defaultMention: 'none',
      // Web Search
			webSearchSettings: {
        webSearchBackend: 'serpapi',
        urlFetchBackend: 'jina',
        serpapiApiKey: '',
        serpapiSearchEngine: 'google',
        scrapingdogApiKey: '',
        scrapingdogSearchEngine: 'google',
        serperApiKey: '',
        jinaApiKey: '',
        braveApiKey: '',
			},
      // File Search
			fileSearchSettings: {
				method: 'auto',
				regexBackend: 'coreplugin',
				matchBackend: 'coreplugin',
				ripgrepPath: '',
			},
      // System Prompt
      systemPrompt: '',
      // RAG Options
      ragOptions: {
				chunkSize: 1000,
				thresholdTokens: 8192,
				minSimilarity: 0.0,
				limit: 10,
				excludePatterns: [],
				includePatterns: [],
			},
      // Autocomplete options
      autocompleteEnabled: true,
      advancedMode: false,
      // Trigger settings
      triggers: DEFAULT_SETTINGS.triggers,
      delay: 500,
      // Request settings
      modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 800,
			},
      // Prompt settings
      systemMessage: DEFAULT_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_SETTINGS.fewShotExamples,
			userMessageTemplate: '{{prefix}}<mask/>{{suffix}}',
			chainOfThoughtRemovalRegex: '(.|\\n)*ANSWER:',
      // Preprocessing settings
      dontIncludeDataviews: true,
			maxPrefixCharLimit: 4000,
			maxSuffixCharLimit: 4000,
      // Postprocessing settings
      removeDuplicateMathBlockIndicator: true,
			removeDuplicateCodeBlockIndicator: true,
			ignoredFilePatterns: '**/secret/**\n',
			ignoredTags: '',
			cacheSuggestions: true,
			debugMode: false,
      // Deprecated settings
      deprecated: {
        // Active Models [compatible]
        activeModels: DEFAULT_MODELS,
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
      },
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
      // Version
			version: SETTINGS_SCHEMA_VERSION,
      // Provider
      defaultProvider: 'Infio',
      infioProvider: {
				name: 'Infio',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      openrouterProvider: {
				name: 'OpenRouter',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			siliconflowProvider: {
				name: 'SiliconFlow',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			alibabaQwenProvider: {
				name: 'AlibabaQwen',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			anthropicProvider: {
				name: 'Anthropic',
				apiKey: 'anthropic-api-key',
				baseUrl: '',
				useCustomUrl: false,
			},
      deepseekProvider: {
				name: 'DeepSeek',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      openaiProvider: {
				name: 'OpenAI',
				apiKey: 'openai-api-key',
				baseUrl: '',
				useCustomUrl: false,
			},
			googleProvider: {
				name: 'Google',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
      ollamaProvider: {
				apiKey: 'ollama',
				baseUrl: 'http://localhost:11434',
				name: 'Ollama',
				useCustomUrl: true,
			},
			groqProvider: {
				name: 'Groq',
				apiKey: 'groq-api-key',
				baseUrl: '',
				useCustomUrl: false,
			},
			grokProvider: {
				name: 'Grok',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
			},
			openaicompatibleProvider: {
				name: 'OpenAICompatible',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: true,
			},
      // MCP Servers
      mcpEnabled: false,
      // Chat Model start list
      collectedChatModels: [],
      // Active Provider Tab (for UI state)
      activeProviderTab: 'Infio',
      // Chat Model
      chatModelProvider: 'Infio',
      chatModelId: 'claude-3.5-sonnet-latest',
      // Apply Model
      applyModelProvider: 'Infio',
			applyModelId: 'gpt-4o-mini',
      // Embedding Model
			embeddingModelProvider: 'Infio',
      embeddingModelId: 'text-embedding-3-small',
      // Fuzzy Match Threshold
      fuzzyMatchThreshold: 0.85,
      // Experimental Diff Strategy
      experimentalDiffStrategy: false,
      // Multi Search Replace Diff Strategy
      multiSearchReplaceDiffStrategy: true,
      // Mode
      mode: 'ask',
			defaultMention: 'none',
      // Web Search
      webSearchSettings: {
        webSearchBackend: 'serpapi',
        urlFetchBackend: 'jina',
        serpapiApiKey: '',
        serpapiSearchEngine: 'google',
        scrapingdogApiKey: '',
        scrapingdogSearchEngine: 'google',
        serperApiKey: '',
        jinaApiKey: '',
        braveApiKey: '',
			},
      // File Search
      fileSearchSettings: {
				method: 'auto',
				regexBackend: 'coreplugin',
				matchBackend: 'coreplugin',
				ripgrepPath: '',
			},
      // System Prompt
      systemPrompt: 'system prompt',
      // RAG Options
      ragOptions: {
				chunkSize: 1000,
				thresholdTokens: 8192,
				minSimilarity: 0.0,
				limit: 10,
				excludePatterns: [],
				includePatterns: [],
			},
      // Autocomplete options
      autocompleteEnabled: true,
			advancedMode: false,
      // Trigger settings
      triggers: DEFAULT_SETTINGS.triggers,
			delay: 500,
      // Request settings
      modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 800,
			},
      // Prompt settings
      systemMessage: DEFAULT_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_SETTINGS.fewShotExamples,
			userMessageTemplate: '{{prefix}}<mask/>{{suffix}}',
      chainOfThoughtRemovalRegex: '(.|\\n)*ANSWER:',
      // Preprocessing settings
      dontIncludeDataviews: true,
			maxPrefixCharLimit: 4000,
			maxSuffixCharLimit: 4000,
      // Postprocessing settings
      removeDuplicateMathBlockIndicator: true,
			removeDuplicateCodeBlockIndicator: true,
			ignoredFilePatterns: '**/secret/**\n',
			ignoredTags: '',
			cacheSuggestions: true,
			debugMode: false,
      // Deprecated settings
      deprecated: {
        // Active Models [compatible]
        activeModels: DEFAULT_MODELS,
        // API Keys [compatible]
        infioApiKey: '',
        openAIApiKey: 'openai-api-key',
        anthropicApiKey: 'anthropic-api-key',
        geminiApiKey: '',
        groqApiKey: 'groq-api-key',
        deepseekApiKey: '',
        // Model settings [compatible]
        embeddingModel: 'text-embedding-3-small',
        chatModel: 'claude-3.5-sonnet-latest',
        applyModel: 'gpt-4o-mini',
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
        ollamaBaseUrl: 'http://localhost:11434',
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
      },
		})
	})
})
