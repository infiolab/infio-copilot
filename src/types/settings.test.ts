import { DEFAULT_SETTINGS } from '../settings/versions/v1/v1'
import { SETTINGS_SCHEMA_VERSION } from '../settings/versions/shared'

import { parseInfioSettings } from './settings'

describe('parseSmartCopilotSettings', () => {
	it('should return default values for empty input', () => {
		const result = parseInfioSettings({
			autocompleteEnabled: true,
			advancedMode: false,
			apiProvider: 'openai',
			triggers: DEFAULT_SETTINGS.triggers,
			delay: 500,
			modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 4096,
			},
			systemMessage: DEFAULT_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_SETTINGS.fewShotExamples,
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
				models: [],
			},
      openrouterProvider: {
				name: 'OpenRouter',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			siliconflowProvider: {
				name: 'SiliconFlow',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      alibabaQwenProvider: {
				name: 'AlibabaQwen',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			anthropicProvider: {
				name: 'Anthropic',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      deepseekProvider: {
				name: 'DeepSeek',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      openaiProvider: {
				name: 'OpenAI',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			googleProvider: {
				name: 'Google',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      ollamaProvider: {
				apiKey: 'ollama',
				baseUrl: '',
				name: 'Ollama',
				useCustomUrl: true,
				models: [],
			},
			groqProvider: {
				name: 'Groq',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			grokProvider: {
				name: 'Grok',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			openaicompatibleProvider: {
				name: 'OpenAICompatible',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: true,
				models: [],
			},
			localproviderProvider: {
				name: 'LocalProvider',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: []
			},
      // MCP Servers
      mcpEnabled: false,
      // Chat Model start list
      collectedChatModels: [],
			// Insight Model start list
			collectedInsightModels: [],
			// Apply Model start list
			collectedApplyModels: [],
			// Embedding Model start list
			collectedEmbeddingModels: [],
      // Active Provider Tab (for UI state)
			activeProviderTab: 'Infio',
      // Chat Model
      chatModelProvider: 'Infio',
			chatModelId: '',
			// Insight Model
			insightModelProvider: 'Infio',
			insightModelId: '',
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
			// Workspace
			workspace: '',
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
				filesystem: 'opfs',
				batchSize: 32,
				chunkSize: 500,
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
				max_tokens: 4096,
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
        enabled: '',
        activeModels: [],
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
        apiProvider: 'openai',
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
        chainOfThoughRemovalRegex: '(.|\\n)*ANSWER:',
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
				filesystem: 'opfs',
				batchSize: 32,
				chunkSize: 500,
				thresholdTokens: 8192,
				minSimilarity: 0.0,
				limit: 10,
			},
			autocompleteEnabled: true,
			advancedMode: false,
			apiProvider: 'openai',
			triggers: DEFAULT_SETTINGS.triggers,
			delay: 500,
			modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 4096,
			},
			systemMessage: DEFAULT_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_SETTINGS.fewShotExamples,
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
				models: [],
			},
      openrouterProvider: {
				name: 'OpenRouter',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			siliconflowProvider: {
				name: 'SiliconFlow',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			alibabaQwenProvider: {
				name: 'AlibabaQwen',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			anthropicProvider: {
				name: 'Anthropic',
				apiKey: 'anthropic-api-key',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      deepseekProvider: {
				name: 'DeepSeek',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      openaiProvider: {
				name: 'OpenAI',
				apiKey: 'openai-api-key',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			googleProvider: {
				name: 'Google',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      ollamaProvider: {
				apiKey: 'ollama',
				baseUrl: 'http://localhost:11434',
				name: 'Ollama',
				useCustomUrl: true,
				models: [],
			},
			groqProvider: {
				name: 'Groq',
				apiKey: 'groq-api-key',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			grokProvider: {
				name: 'Grok',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
			openaicompatibleProvider: {
				name: 'OpenAICompatible',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: true,
				models: [],
			},
			localproviderProvider: {
				name: 'LocalProvider',
				apiKey: '',
				baseUrl: '',
				useCustomUrl: false,
				models: [],
			},
      // MCP Servers
      mcpEnabled: false,
      // Chat Model start list
      collectedChatModels: [],
			// Insight Model start list
			collectedInsightModels: [],
			// Apply Model start list
			collectedApplyModels: [],
			// Embedding Model start list
			collectedEmbeddingModels: [],
      // Active Provider Tab (for UI state)
      activeProviderTab: 'Infio',
      // Chat Model
      chatModelProvider: 'Infio',
      chatModelId: 'claude-3.5-sonnet-latest',
			// Insight Model
			insightModelProvider: 'Infio',
			insightModelId: '',
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
			// Workspace
			workspace: '',
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
				filesystem: 'opfs',
				batchSize: 32,
				chunkSize: 500,
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
				max_tokens: 4096,
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
        enabled: '',
        activeModels: [],
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
        apiProvider: 'openai',
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
        chainOfThoughRemovalRegex: '(.|\\n)*ANSWER:',
      },
		})
	})

	it('should migrate max_tokens from old value to new minimum', () => {
		// Test case: user has old max_tokens value (800) that needs to be migrated
		const settingsWithOldMaxTokens = {
			version: 0.4,
			modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 800, // Old value that's below new minimum
			},
			// Include other required fields for valid settings
			autocompleteEnabled: true,
			advancedMode: false,
			apiProvider: 'openai',
			triggers: DEFAULT_SETTINGS.triggers,
			delay: 500,
			systemMessage: DEFAULT_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_SETTINGS.fewShotExamples,
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
		}

		const result = parseInfioSettings(settingsWithOldMaxTokens)
		
		// Should successfully parse and migrate max_tokens to 4096
		expect(result.modelOptions.max_tokens).toBe(4096)
		expect(result.version).toBe(0.5)
	})

	it('should not change max_tokens if it is already above minimum', () => {
		// Test case: user has max_tokens already above minimum
		const settingsWithValidMaxTokens = {
			version: 0.4,
			modelOptions: {
				temperature: 1,
				top_p: 0.1,
				frequency_penalty: 0.25,
				presence_penalty: 0,
				max_tokens: 6000, // Already above minimum
			},
			// Include other required fields for valid settings
			autocompleteEnabled: true,
			advancedMode: false,
			apiProvider: 'openai',
			triggers: DEFAULT_SETTINGS.triggers,
			delay: 500,
			systemMessage: DEFAULT_SETTINGS.systemMessage,
			fewShotExamples: DEFAULT_SETTINGS.fewShotExamples,
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
		}

		const result = parseInfioSettings(settingsWithValidMaxTokens)
		
		// Should keep the existing max_tokens value since it's already valid
		expect(result.modelOptions.max_tokens).toBe(6000)
		expect(result.version).toBe(0.5)
	})
})
