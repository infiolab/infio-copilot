import { z } from "zod";

import { isRegexValid, isValidIgnorePattern } from "../../../utils/auto-complete";
import {
	MAX_DELAY, MAX_MAX_CHAR_LIMIT,
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
import math_block_multi_line from "./few-shot-examples/math-block-multiline";
import numbered_list_example from "./few-shot-examples/numbered-list-example";
import sub_task_list_example from "./few-shot-examples/subtask-list-example";
import task_list_example from "./few-shot-examples/task-list-example";
import text_completion_end from "./few-shot-examples/text-completion-end";
import text_completion_middle from "./few-shot-examples/text-completion-middle";
import unordered_list_pro_and_con_list from "./few-shot-examples/unordered-list-pro-and-con-list";
import unordered_list_solid from "./few-shot-examples/unordered-list-solid";

import { triggerSchema, InfioSettingsSchema } from "../../../types/settings";

// Unused code
//----Start
export const settingsSchema = z.object({
	version: z.literal("1"),
	advancedMode: z.boolean(),
	triggers: z.array(triggerSchema),
	delay: z.number().int().min(MIN_DELAY, { message: "Delay must be between 0ms and 2000ms" }).max(MAX_DELAY, { message: "Delay must be between 0ms and 2000ms" }),
	modelOptions: modelOptionsSchema,
	systemMessage: z.string().min(3, { message: "System message must be at least 3 characters long" }),
	fewShotExamples: z.array(fewShotExampleSchema),
	userMessageTemplate: z.string().min(3, { message: "User message template must be at least 3 characters long" }),
	chainOfThoughtRemovalRegex: z.string().refine((regex) => isRegexValid(regex), { message: "Invalid regex" }),
	dontIncludeDataviews: z.boolean(),
	maxPrefixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }),
	maxSuffixCharLimit: z.number().int().min(MIN_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at least ${MIN_MAX_CHAR_LIMIT}` }).max(MAX_MAX_CHAR_LIMIT, { message: `Max prefix char limit must be at most ${MAX_MAX_CHAR_LIMIT}` }),
	removeDuplicateMathBlockIndicator: z.boolean(),
	removeDuplicateCodeBlockIndicator: z.boolean(),
	ignoredFilePatterns: z.string().refine((value) => value
		.split("\n")
		.filter(s => s.trim().length > 0)
		.filter(s => !isValidIgnorePattern(s)).length === 0,
		{ message: "Invalid ignore pattern" }
	),
	ignoredTags: z.string().refine((value) => value
		.split("\n")
		.filter(s => s.includes(" ")).length === 0, { message: "Tags cannot contain spaces" }
	).refine((value) => value
		.split("\n")
		.filter(s => s.includes("#")).length === 0, { message: "Enter tags without the # symbol" }
	).refine((value) => value
		.split("\n")
		.filter(s => s.includes(",")).length === 0, { message: "Enter each tag on a new line without commas" }
	),
	cacheSuggestions: z.boolean(),
	debugMode: z.boolean(),
}).strict();

export const pluginDataSchema = z.object({
	settings: settingsSchema,
}).strict();
//----End

export const DEFAULT_SETTINGS = {
	// Provider
  infioProvider: InfioSettingsSchema.shape['infioProvider'].parse({}),
  openrouterProvider: InfioSettingsSchema.shape['openrouterProvider'].parse({}),
  siliconflowProvider: InfioSettingsSchema.shape['siliconflowProvider'].parse({}),
  alibabaQwenProvider: InfioSettingsSchema.shape['alibabaQwenProvider'].parse({}),
  anthropicProvider: InfioSettingsSchema.shape['anthropicProvider'].parse({}),
  deepseekProvider: InfioSettingsSchema.shape['deepseekProvider'].parse({}),
	openaiProvider: InfioSettingsSchema.shape['openaiProvider'].parse({}),
  googleProvider: InfioSettingsSchema.shape['googleProvider'].parse({}),
	ollamaProvider: InfioSettingsSchema.shape['ollamaProvider'].parse({}),
  groqProvider: InfioSettingsSchema.shape['groqProvider'].parse({}),
  grokProvider: InfioSettingsSchema.shape['grokProvider'].parse({}),
  openaicompatibleProvider: InfioSettingsSchema.shape['openaicompatibleProvider'].parse({}),

	// Web Search
	webSearchSettings: InfioSettingsSchema.shape['webSearchSettings'].parse({}),

	// File Search
	fileSearchSettings: InfioSettingsSchema.shape['fileSearchSettings'].parse({}),

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
		{ type: "string", value: "> " },
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
If the <mask/> is in the middle of a partial sentence, your answer should only be the 1 or 2 words fixes the sentence and not the entire sentence.
You are not allowed to have any overlapping text directly surrounding the <mask/>.  
Your answer must be in the same language as the text directly surrounding the <mask/>.
Your response must have the following format:
THOUGHT: here, you reason about the answer; use the 80/20 principle to be brief.
LANGUAGE: here, you write the language of your answer, e.g. English, Python, Dutch, etc.
ANSWER: here, you write the text that should be at the location of <mask/>
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
	// Postprocessing settings
	ignoredFilePatterns: "**/secret/**\n",
	ignoredTags: "",
};

export type Trigger = z.infer<typeof triggerSchema>;
export type Settings = z.input<typeof settingsSchema>;
export type PluginData = z.infer<typeof pluginDataSchema>;
