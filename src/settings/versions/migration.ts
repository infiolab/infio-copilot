import { cloneDeep, get, has, set } from "lodash";

import { findEqualPaths, isRegexValid } from "../../utils/auto-complete";

import {
	DEFAULT_SETTINGS as DEFAULT_SETTINGS_V0,
	Settings as SettingsV0,
	Trigger,
	settingsSchema as settingsSchemaV0
} from "./v0/v0";
import {
	DEFAULT_SETTINGS as DEFAULT_SETTINGS_V1,
	Settings as SettingsV1,
	settingsSchema as settingsSchemaV1
} from "./v1/v1";

export function migrateFromV0ToV1(settings: SettingsV0): SettingsV1 {
	// eslint-disable  @typescript-eslint/no-explicit-any
	const updatedSettings: any = cloneDeep(settings);
	migrateDefaultSettings(updatedSettings, DEFAULT_SETTINGS_V0, DEFAULT_SETTINGS_V1);

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
		updatedSettings.chainOfThoughtRemovalRegex = DEFAULT_SETTINGS_V1.chainOfThoughtRemovalRegex;
	}

	updatedSettings.ignoredFilePatterns = DEFAULT_SETTINGS_V1.ignoredFilePatterns;
	updatedSettings.ignoredTags = DEFAULT_SETTINGS_V1.ignoredTags;
	updatedSettings.cacheSuggestions = DEFAULT_SETTINGS_V1.cacheSuggestions;
	updatedSettings.ollamaApiSettings = DEFAULT_SETTINGS_V1.ollamaApiSettings;
	updatedSettings.debugMode = DEFAULT_SETTINGS_V1.debugMode;

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
