// @ts-nocheck
import { cloneDeep, each, get, has, isArray, isEqual, isNumber, isObject, isString, set, unset } from "lodash";
import * as mm from "micromatch";
import { Result, err, ok } from "neverthrow";
import { ZodError, ZodIssueCode, ZodType, z } from 'zod';

import { DEFAULT_SETTINGS, PluginData, Settings } from "../settings/versions";
import { isSettingsV0, isSettingsV1, migrateFromV0ToV1 } from "../settings/versions/migration";
import { InfioSettings, InfioSettingsSchema } from '../types/settings';

type JSONObject = Record<string, any>;

export function checkForErrors(settings: InfioSettings) {
	const errors = new Map<string, string>();
	const parsingResult = parseWithSchema(InfioSettingsSchema, settings);

	if (parsingResult.isOk()) {
		return errors;
	}

	if (parsingResult.error instanceof ZodError) {
		for (const issue of parsingResult.error.issues) {
			errors.set(issue.path.join('.'), issue.message);
		}
	} else {
		throw parsingResult.error;
	}

	return errors;
}


export function fixStructureAndValueErrors<T extends ZodType>(
	schema: T,
	value: any | null | undefined,
	defaultValue: z.infer<T>,
): Result<ReturnType<T["parse"]>, Error> {
	if (value === null || value === undefined) {
		value = {};
	}
	let result = parseWithSchema(schema, value);

	if (result.isErr()) {
		value = addMissingKeys(value, result.error, defaultValue);
		value = removeUnrecognizedKeys(value, result.error);
		result = parseWithSchema(schema, value);
	}

	if (result.isErr() && value !== null && value !== undefined) {
		value = replaceValuesWithErrorsByDefaultValue(value, result.error, defaultValue);
		result = parseWithSchema(schema, value);
	}

	return result;
}

export function parseWithSchema<T extends ZodType>(
	schema: T,
	value: JSONObject | null | undefined
): Result<ReturnType<T["parse"]>, ZodError> {
	const parsingResult = schema.safeParse(value);
	return parsingResult.success ? ok(parsingResult.data) : err(parsingResult.error);
}

function addMissingKeys<T extends object>(value: JSONObject, error: ZodError, defaultValue: T): JSONObject {
	const invalidTypeIssues = error.issues.filter(issue => issue.code === ZodIssueCode.invalid_type);
	const errorPaths = invalidTypeIssues
		.map(issue => issue.path)
		.map(path => reduceArrayPathToFirstObjectPath(path))
		.map(path => path.join('.'));

	return replaceValueWithDefaultValue(value, errorPaths, defaultValue);
}

function replaceValueWithDefaultValue<V, T>(
	value: any,
	paths: string[],
	defaultValue: T,
): V {
	const result = cloneDeep(value);
	paths.forEach(path => {
		const originalValue = has(defaultValue, path) ? get(defaultValue, path) : undefined;
		set(result, path, originalValue);
	});

	return result;
}


function removeUnrecognizedKeys(value: JSONObject | null | undefined, error: ZodError): JSONObject {
	if (typeof value !== 'object' || value === null || value === undefined) {
		return {};
	}
	// Zod unrecognized_keys issues consist of two parts:
	// - path to the nested object where the unrecognized key was found
	// - the key itself which is unrecognized
	const unrecognizedPaths = error.issues

		.filter(issue => issue.code === ZodIssueCode.unrecognized_keys)
		// Array path will be handled separately by the value replacement function
		.filter(issue => !isAnArrayPath(issue.path))
		.flatMap(issue => {
			// @ts-expect-error
			const keys = issue.keys;
			return keys.map(key => [...issue.path, key].join('.'));
		});

	unrecognizedPaths.forEach(path => {
		unset(value, path);
	});
	return value;
}


function replaceValuesWithErrorsByDefaultValue<T>(
	value: JSONObject,
	error: ZodError,
	defaultValue: T
): T {
	const errorPaths = error.issues
		.map(issue => issue.path)
		.map(path => reduceArrayPathToFirstObjectPath(path))
		.map(path => path.join('.'));

	return replaceValueWithDefaultValue(value, errorPaths, defaultValue);
}

function reduceArrayPathToFirstObjectPath(path: (string | number)[]): (string | number)[] {
	const result: (string | number)[] = [];
	for (const key of path) {
		if (typeof key === 'number') {
			break;
		}
		result.push(key);
	}

	return result;
}

function isAnArrayPath(path: (string | number)[]): boolean {
	return path.some(key => typeof key === 'number');
}

// Unused code
//----Start
export function serializeSettings(settings: Settings): PluginData {
	return { settings: settings };
}

export function deserializeSettings(data: JSONObject | null | undefined): Result<Settings, Error> {
	let settings: any;
	if (data === null || data === undefined || !data.hasOwnProperty("settings")) {
		settings = {};
	} else {
		settings = data.settings;
	}

	if (isSettingsV0(settings)) {
		settings = migrateFromV0ToV1(settings);
	}
	if (!isSettingsV1(settings)) {
		return fixStructureAndValueErrors(settingsSchema, settings, DEFAULT_SETTINGS);
	}

	return parseWithSchema(settingsSchema, settings);
}
//----End

export function isRegexValid(value: string): boolean {
	try {
		const regex = new RegExp(value);
		regex.test("");
		return true;
	} catch (e) {
		return false;
	}
}

export function isValidIgnorePattern(value: string): boolean {
	try {
		mm.isMatch("", value);
		return true;
	} catch (e) {
		return false;
	}
}

export function findEqualPaths(obj1: any, obj2: any, basePath = ''): string[] {
	let paths: string[] = [];

	if (
		basePath === ''
		&& (
			!isObject(obj1)
			|| !isObject(obj2)
			|| isArray(obj1)
			|| isArray(obj2)
			|| isNumber(obj1)
			|| isNumber(obj2)
			|| isString(obj1)
			|| isString(obj2)
		)
	) {
		return [];
	}

	// Function to iterate over keys and compare values
	function iterateKeys(value: any, key: string | number): void {
		const path = basePath ? `${basePath}.${key}` : `${key}`;
		if (isObject(value) && isObject(get(obj2, key))) {
			// Recursively find paths for nested objects
			paths = paths.concat(findEqualPaths(value, get(obj2, key), path));
		} else if (isEqual(value, get(obj2, key))) {
			// Add path to array if values are equal
			paths.push(path);
		}
	}

	// If both are arrays, iterate using each index
	if (isArray(obj1) && isArray(obj2)) {
		each(obj1, (value, index) => iterateKeys(value, `[${index}]`));
	} else {
		// Iterate over keys of the first object
		each(obj1, iterateKeys);
	}

	return paths;
}
