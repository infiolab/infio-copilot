
import { z } from "zod";

import {
  MAX_DELAY,
  MAX_MAX_CHAR_LIMIT,
  MIN_DELAY,
  MIN_MAX_CHAR_LIMIT,
  fewShotExampleSchema,
  modelOptionsSchema,
} from "../shared";

import block_qoute_example from "./few-shot-examples/block-qoute-example";
import codeblock_function_completion from "./few-shot-examples/codeblock-function-completion";
import codeblock_function_parameters from "./few-shot-examples/codeblock-function-parameters";
import header_example from "./few-shot-examples/header-example";
import header_example_relu from "./few-shot-examples/header-example-relu";
import math_block_inline from "./few-shot-examples/math-block-inline";
import math_block_multi_line from "./few-shot-examples/math-block-multi-line";
import numbered_list_example from "./few-shot-examples/numbered-list-example";
import sub_task_list_example from "./few-shot-examples/sub-task-list-example";
import task_list_example from "./few-shot-examples/task-list-example";
import text_completion_end from "./few-shot-examples/text-completion-end";
import text_completion_middle from "./few-shot-examples/text-completion-middle";
import unordered_list_pro_and_con_list from "./few-shot-examples/unordered-list-pro-and-con-list";
import unordered_list_solid from "./few-shot-examples/unordered-list-solid";

export const azureOAIApiSettingsSchema = z.object({
	key: z.string(),
	url: z.string().url().or(z.string().max(0)),
}).strict();

export const openAIApiSettingsSchema = z.object({
	key: z.string(),
	url: z.string().url(),
	model: z.string(),
}).strict();

export const ollamaApiSettingsSchema = z.object({
	url: z.string().url(),
	model: z.string(),
}).strict();

export const triggerSchema = z.object({
	type: z.enum(['string', 'regex']),
	value: z.string(),
}).strict();

export const settingsSchema = z.object({
	enabled: z.boolean(),
	advancedMode: z.boolean(),
  // API settings
	apiProvider: z.enum(['azure', 'openai']),
	azureOAIApiSettings: azureOAIApiSettingsSchema,
	openAIApiSettings: openAIApiSettingsSchema,
  ollamaApiSettings: ollamaApiSettingsSchema,
	triggers: z.array(triggerSchema),
	delay: z.number().int().min(MIN_DELAY, { message: "Delay must be between 0ms and 2000ms" }).max(MAX_DELAY, { message: "Delay must be between 0ms and 2000ms" }),
	modelOptions: modelOptionsSchema,
	systemMessage: z.string().min(3, { message: "System message must be at least 3 characters long" }),
	fewShotExamples: z.array(fewShotExampleSchema),
	userMessageTemplate: z.string().min(3, { message: "User message template must be at least 3 characters long" }),
	chainOfThoughtRemovalRegex: z.string(),
	dontIncludeDataviews: z.boolean(),
	// TODO: see if we can replace this with tokens in the future.
	maxPrefixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }),
	maxSuffixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }),
	removeDuplicateMathBlockIndicator: z.boolean(),
	removeDuplicateCodeBlockIndicator: z.boolean()
}).strict();

export const pluginDataSchema = z.object({
	settings: settingsSchema,
}).strict();


export const DEFAULT_SETTINGS_V0: Settings = {
	// General settings
	enabled: true,
	advancedMode: false,
  // API settings
	apiProvider: "openai",
	azureOAIApiSettings: {
		key: "",
		url: "",
	},
	openAIApiSettings: {
		key: "",
		url: "https://api.openai.com/v1/chat/completions",
		model: "gpt-3.5-turbo",
	},
  ollamaApiSettings: {
		url: "http://localhost:11434/api/chat",
		model: "",
  },

	// Trigger settings
	triggers: [
		{ type: "string", value: "# " },
		{ type: "string", value: ". " },
		{ type: "string", value: ": " },
		{ type: "string", value: ", " },
		{ type: "string", value: "! " },
		{ type: "string", value: "? " },
		{ type: "string", value: "`" },
		{ type: "string", value: "' " },
		{ type: "string", value: "= " },
		{ type: "string", value: "$ " },
		{ type: "string", value: "\n" },

		// bullet list
		{ type: "regex", value: "[\\t ]*(\\-|\\*)[\\t ]+$" },
		// numbered list
		{ type: "regex", value: "[\\t ]*[0-9A-Za-z]+\\.[\\t ]+$" },
		// new line with spaces
		{ type: "regex", value: "\\$\\$\\n[\\t ]*$" },
		// markdown multiline code block
		{ type: "regex", value: "```[a-zA-Z0-9]*(\\n\\s*)?$" },
		// task list normal, sub or numbered.
		{ type: "regex", value: "\\s*(-|[0-9]+\\.) \\[.\\]\\s+$" },
	],
	delay: 1000,

	// Request settings
	modelOptions: {
		temperature: 1,
		top_p: 0.1,
		frequency_penalty: 0.25,
		presence_penalty: 0,
		max_tokens: 800,
	},
	// Prompt settings
	systemMessage: `Your job is to predict the most logical text that should be written at the location of the <mask/>.
Your answer can be either code, a single word, or multiple sentences.
Your answer must be in the same language as the text that is already there.
Your response must have the following format:
THOUGHT: here you explain your reasoning of what could be at the location of <mask/>
ANSWER: here you write the text that should be at the location of <mask/>
`,
	fewShotExamples: [
		block_qoute_example,
		codeblock_function_completion,
		codeblock_function_parameters,
		header_example,
		numbered_list_example,
		sub_task_list_example,
		task_list_example,
		text_completion_end,
		text_completion_middle,
		unordered_list_pro_and_con_list,
		unordered_list_solid,
		math_block_inline,
		math_block_multi_line,
		header_example_relu,
	].sort((a, b) => a.toString().localeCompare(b.toString())),
	userMessageTemplate: "{{prefix}}<mask/>{{suffix}}",
	chainOfThoughtRemovalRegex: `(.|\\n)*ANSWER:`,
	// Preprocessing settings
	dontIncludeDataviews: true,
	maxPrefixCharLimit: 2000,
	maxSuffixCharLimit: 2000,
	// Postprocessing settings
	removeDuplicateMathBlockIndicator: true,
	removeDuplicateCodeBlockIndicator: true,
};

export const DEFAULT_PLUGIN_DATA: PluginData = {
	settings: DEFAULT_SETTINGS_V0,
}

export type Settings = z.input<typeof settingsSchema>;
export type Trigger = z.infer<typeof triggerSchema>;
export type PluginData = z.infer<typeof pluginDataSchema>;
