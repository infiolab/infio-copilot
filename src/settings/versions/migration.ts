import { cloneDeep, get, has, set } from "lodash";

import { findEqualPaths, isRegexValid } from "../../utils/auto-complete";

import { MIN_MAX_TOKENS } from "../../settings/versions/shared";
import {
	DEFAULT_SETTINGS_V0,
	Settings as SettingsV0,
	Trigger,
	settingsSchema as settingsSchemaV0
} from "./v0/v0";
import {
	DEFAULT_SETTINGS,
	Settings as SettingsV1,
	settingsSchema as settingsSchemaV1
} from "./v1/v1";
import {
  SETTINGS_SCHEMA_VERSION,
} from "../../types/settings"
import { DeprecatedSettingsSchema } from "../../types/settings"

// The confusing unused migration codes
//----Start
export function migrateFromV0ToV1(settings: SettingsV0): SettingsV1 {
	// eslint-disable  @typescript-eslint/no-explicit-any
	const updatedSettings: any = cloneDeep(settings);
	migrateDefaultSettings(updatedSettings, DEFAULT_SETTINGS_V0, DEFAULT_SETTINGS);

	updatedSettings.triggers.forEach((trigger: Trigger) => {
		// Check if the trigger type is 'regex' and if its value does not end with '$'
		if (trigger.type === 'regex' && !trigger.value.endsWith('$')) {
			// Append '$' to the trigger value
			trigger.value += '$';
		}
	});

	updatedSettings.triggers = updatedSettings
		.triggers
		.filter((trigger: Trigger) => trigger.value.length > 0)
		.filter((trigger: Trigger) => trigger.type !== 'regex' || isRegexValid(trigger.value));

	// Add the 'version' property with the value '1'
	updatedSettings.version = '1';

	if (!isRegexValid(updatedSettings.chainOfThoughtRemovalRegex)) {
		updatedSettings.chainOfThoughtRemovalRegex = DEFAULT_SETTINGS.chainOfThoughtRemovalRegex;
	}

	updatedSettings.ignoredFilePatterns = DEFAULT_SETTINGS.ignoredFilePatterns;
	updatedSettings.ignoredTags = DEFAULT_SETTINGS.ignoredTags;
	//updatedSettings.cacheSuggestions = DEFAULT_SETTINGS.cacheSuggestions;
	//updatedSettings.ollamaApiSettings = DEFAULT_SETTINGS.ollamaApiSettings;
	//updatedSettings.debugMode = DEFAULT_SETTINGS.debugMode;

	// Parsing the updated settings to ensure they match the SettingsV1 schema
	return settingsSchemaV1.parse(updatedSettings);
}


function migrateDefaultSettings(setting: any, previousDefault: any, currentDefault: any): any {
	const unchangedDefaultProperties = findEqualPaths(setting, previousDefault);
	for (const path of unchangedDefaultProperties) {
		if (has(currentDefault, path)) {
			const newDefaultValue = get(currentDefault, path);
			set(setting, path, newDefaultValue);
		}
	}
}


export const isSettingsV0 = (settings: object): boolean => {
	const result = settingsSchemaV0.safeParse(settings);
	return result.success;
}


export const isSettingsV1 = (settings: object): boolean => {
	const result = settingsSchemaV1.safeParse(settings);
	return result.success;
}
//----End

// Migration codes from `setting.ts`
type Migration = {
	fromVersion?: number
	toVersion: number
  message?: string
	migrate: (data: Record<string, unknown>) => Record<string, unknown>
}

const MIGRATIONS: Migration[] = [
	{
		fromVersion: 0.1,
		toVersion: 0.4,
		migrate: (data) => {
			const newData = { ...data };
			newData.version = SETTINGS_SCHEMA_VERSION;
			return newData;
		},
	},
	{
		fromVersion: 0.4,
		toVersion: SETTINGS_SCHEMA_VERSION,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION
			
			// Handle max_tokens minimum value increase from 800 to 4096
			if (newData.modelOptions && typeof newData.modelOptions === 'object') {
				const modelOptions = newData.modelOptions as Record<string, any>
				if (typeof modelOptions.max_tokens === 'number' && modelOptions.max_tokens < MIN_MAX_TOKENS) {
					console.log(`Updating max_tokens from ${modelOptions.max_tokens} to ${MIN_MAX_TOKENS} due to minimum value change`)
					modelOptions.max_tokens = MIN_MAX_TOKENS
				}
			}
			
			return newData
		},
	},
  // Provider settings migration
	{
    toVersion: SETTINGS_SCHEMA_VERSION,
    message: `Migrating older provider settings to v${SETTINGS_SCHEMA_VERSION}.`,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION

      if (!newData.infioProvider && newData.infioApiKey) {
        newData.infioProvider = {
          ...DEFAULT_SETTINGS.infioProvider,
          apiKey: newData.infioApiKey,
        };
      }
      if (!newData.anthropicProvider && newData.anthropicApiKey) {
        newData.anthropicProvider = {
          ...DEFAULT_SETTINGS.anthropicProvider,
          apiKey: newData.anthropicApiKey,
        };
      }
      if (!newData.deepseekProvider && newData.deepseekApiKey) {
        newData.deepseekProvider = {
          ...DEFAULT_SETTINGS.deepseekProvider,
          apiKey: newData.deepseekApiKey,
        };
      }
      if (
        !newData.openaiProvider &&
        (newData.openAIApiSettings || newData.openAIApiKey)
      ) {
        // @ts-ignore
        const openAIApiKey = newData.openAIApiKey || newData.openAIApiSettings.key;
        newData.openaiProvider = {
          ...DEFAULT_SETTINGS.openaiProvider,
          apiKey: openAIApiKey,
        };
      }
      if (!newData.googleProvider && newData.geminiApiKey) {
        newData.googleProvider = {
          ...DEFAULT_SETTINGS.googleProvider,
          apiKey: newData.geminiApiKey,
        };
      }
      if (
        !newData.ollamaProvider &&
        (newData.ollamaApiSettings || newData.ollamaBaseUrl)
      ) {
        let urlFromOldApiSettings = (
          (newData.ollamaApiSettings && newData.ollamaApiSettings === 'object')
            // @ts-ignore
            ? newData.ollamaApiSettings.url
            : newData.ollamaBaseUrl
        );
        const ollamaBaseUrl = urlFromOldApiSettings || newData.ollamaBaseUrl;
        newData.ollamaProvider = {
          ...DEFAULT_SETTINGS.ollamaProvider,
          baseUrl: ollamaBaseUrl,
        };
      }
      if (!newData.groqProvider && newData.groqApiKey) {
        newData.groqProvider = {
          ...DEFAULT_SETTINGS.groqProvider,
          apiKey: newData.groqApiKey,
        };
      }
      if (
        !newData.openaicompatibleProvider &&
        newData.azureOAIApiSettings
      ) {
        newData.openaicompatibleProvider = {
          ...DEFAULT_SETTINGS.openaicompatibleProvider,
          // @ts-ignore
          apiKey: newData.azureOAIApiSettings.key,
          // @ts-ignore
          baseUrl: newData.azureOAIApiSettings.url,
        };
      }

			return newData;
		},
	},
  // Model settings migration
	{
    toVersion: SETTINGS_SCHEMA_VERSION,
    message: `Migrating older model settings to v${SETTINGS_SCHEMA_VERSION}.`,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION

      if (!newData.embeddingModelId && newData.embeddingModel) {
        newData.embeddingModelId = newData.embeddingModel;
      }
      if (!newData.chatModelId && newData.chatModel) {
        newData.chatModelId = newData.chatModel;
      }
      if (!newData.applyModelId && newData.applyModel) {
        newData.applyModelId = newData.applyModel;
      }

			return newData;
		},
	},
  // Web search settings migration
  {
    toVersion: SETTINGS_SCHEMA_VERSION,
    message: `Migrating older web search settings to v${SETTINGS_SCHEMA_VERSION}.`,
		migrate: (data) => {
      const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION

      if (!newData.webSearchSettings) {
        newData.webSearchSettings = {
          ...DEFAULT_SETTINGS.webSearchSettings,
          // Previous settings mistakenly treat SerpAPI as Serper.
          serpapiApiKey: newData.serperApiKey,
          serpapiSearchEngine: newData.serperSearchEngine,
          jinaApiKey: newData.jinaApiKey,
        };
      }

      return newData;
    }
  },
  // File search settings migration
  {
    toVersion: SETTINGS_SCHEMA_VERSION,
    message: `Migrating older file search settings to v${SETTINGS_SCHEMA_VERSION}.`,
		migrate: (data) => {
      const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION

      if (!newData.fileSearchSettings) {
        if (newData.filesSearchSettings) {
          newData.fileSearchSettings = {
            ...DEFAULT_SETTINGS.fileSearchSettings,
            // @ts-ignore
            ...newData.filesSearchSettings,
          };
        } else {
          newData.fileSearchSettings = {
            ...DEFAULT_SETTINGS.fileSearchSettings,
            method: newData.filesSearchMethod,
            ripgrepPath: newData.ripgrepPath,
          };
        }
      }

      return newData;
    }
  },
  // Disc settings migration
	{
    toVersion: SETTINGS_SCHEMA_VERSION,
    message: `Migrating older disc settings to v${SETTINGS_SCHEMA_VERSION}.`,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION

			if (
        !newData.chainOfThoughtRemovalRegex &&
        newData.chainOfThoughRemovalRegex
      ) {
				newData.chainOfThoughtRemovalRegex = newData.chainOfThoughRemovalRegex;
			}

			return newData
		},
	},
  // Unused settings deprecation
	{
    toVersion: SETTINGS_SCHEMA_VERSION,
    message: `Deprecating unused settings.`,
		migrate: (data) => {
			const newData = { ...data }
			newData.version = SETTINGS_SCHEMA_VERSION

      newData.deprecated = {
        ...DeprecatedSettingsSchema.parse({}),
        // Active Models [compatible]
        enabled: newData.enabled,
        activeModels: newData.activeModels,
        // API Keys [compatible]
        infioApiKey: newData.infioApiKey,
        openAIApiKey: newData.openAIApiKey,
        anthropicApiKey: newData.anthropicApiKey,
        geminiApiKey: newData.geminiApiKey,
        groqApiKey: newData.groqApiKey,
        deepseekApiKey: newData.deepseekApiKey,
        // Model settings [compatible]
        embeddingModel: newData.embeddingModel,
        chatModel: newData.chatModel,
        applyModel: newData.applyModel,
        // API Settings[compatible]
        apiProvider: newData.apiProvider,
        ollamaBaseUrl: newData.ollamaBaseUrl,
        // Web search settings [compatible]
        serperApiKey: newData.serperApiKey,
        serperSearchEngine: newData.serperSearchEngine,
        jinaApiKey: newData.jinaApiKey,
        // File search settings [compatible]
        filesSearchMethod: newData.filesSearchMethod,
        ripgrepPath: newData.ripgrepPath,
        // Disc settings [compatible]
        chainOfThoughRemovalRegex: newData.chainOfThoughRemovalRegex,
      };

			return newData
		},
	},
]

export function migrateSettings(
	data: Record<string, unknown>,
): Record<string, unknown> {
	let currentData = { ...data }
	const currentVersion = (currentData.version as number) ?? 0

	for (const migration of MIGRATIONS) {
		if (
      migration.toVersion <= SETTINGS_SCHEMA_VERSION &&
      currentVersion <= SETTINGS_SCHEMA_VERSION
    ) {
      if (
        migration.fromVersion && (
          migration.fromVersion <= migration.toVersion &&
          currentVersion <= migration.fromVersion
        )
      ) {
        if (migration.message) {
          console.log(migration.message)
        } else {
          console.log(
            `Migrating settings from v${currentVersion} and older to v${migration.toVersion}.`,
          )
        }
        currentData = migration.migrate(currentData)
      } else if (!migration.fromVersion && currentVersion <= migration.toVersion) {
        if (migration.message) {
          console.log(migration.message)
        } else {
          console.log(`Migrating older settings format to v${migration.toVersion} format.`)
        }
        currentData = migration.migrate(currentData)
      }
		}
	}

	return currentData
}