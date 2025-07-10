import * as Handlebars from "handlebars";
import { Result, err, ok } from "neverthrow";

import { FewShotExample } from "../../settings/versions";
import { LLMModel } from "../../types/llm/model";
import { RequestMessage } from '../../types/llm/request';
import { InfioSettings } from "../../types/settings";
import LLMManager from '../llm/manager';

import Context from "./context-detection";
import RemoveCodeIndicators from "./post-processors/remove-code-indicators";
import RemoveMathIndicators from "./post-processors/remove-math-indicators";
import RemoveOverlap from "./post-processors/remove-overlap";
import RemoveWhitespace from "./post-processors/remove-whitespace";
import DataViewRemover from "./pre-processors/data-view-remover";
import LengthLimiter from "./pre-processors/length-limiter";
import {
	AutocompleteService,
	ChatMessage,
	PostProcessor,
	PreProcessor,
	UserMessageFormatter,
	UserMessageFormattingInputs
} from "./types";

class LLMClient {
	private llm: LLMManager;
	private model: LLMModel;

	constructor(llm: LLMManager, model: LLMModel) {
		this.llm = llm;
		this.model = model;
	}

	async queryChatModel(messages: RequestMessage[]): Promise<Result<string, Error>> {
		const stream = await this.llm.streamResponse(
			this.model,
			{
				messages: messages,
				model: this.model.modelId,
				stream: true,
			}
		)

		let response_content = ""
		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content ?? ''
			response_content += content
		}
		return ok(response_content);
	}

	async queryChatModelStream(messages: RequestMessage[]): Promise<AsyncIterable<string>> {
		const stream = await this.llm.streamResponse(this.model, {
			model: this.model.modelId,
			messages: messages,
			stream: true,
		})
		// eslint-disable-next-line no-inner-declarations
		async function* streamResponse(): AsyncIterable<string> {
			for await (const chunk of stream) {
				yield chunk.choices[0].delta.content;
			}
		}

		return streamResponse()
	}
}


class AutoComplete implements AutocompleteService {
	private readonly client: LLMClient;
	private readonly systemMessage: string;
	private readonly userMessageFormatter: UserMessageFormatter;
	private readonly removePreAnswerGenerationRegex: string;
	private readonly preProcessors: PreProcessor[];
	private readonly postProcessors: PostProcessor[];
	private readonly fewShotExamples: FewShotExample[];
	private debugMode: boolean;

	private constructor(
		client: LLMClient,
		systemMessage: string,
		userMessageFormatter: UserMessageFormatter,
		removePreAnswerGenerationRegex: string,
		preProcessors: PreProcessor[],
		postProcessors: PostProcessor[],
		fewShotExamples: FewShotExample[],
		debugMode: boolean,
	) {
		this.client = client;
		this.systemMessage = systemMessage;
		this.userMessageFormatter = userMessageFormatter;
		this.removePreAnswerGenerationRegex = removePreAnswerGenerationRegex;
		this.preProcessors = preProcessors;
		this.postProcessors = postProcessors;
		this.fewShotExamples = fewShotExamples;
		this.debugMode = debugMode;
	}

	public static fromSettings(settings: InfioSettings): AutocompleteService {
		const formatter = Handlebars.compile<UserMessageFormattingInputs>(
			settings.userMessageTemplate,
			{ noEscape: true, strict: true }
		);
		const preProcessors: PreProcessor[] = [];
		if (settings.dontIncludeDataviews) {
			preProcessors.push(new DataViewRemover());
		}
		preProcessors.push(
			new LengthLimiter(
				settings.maxPrefixCharLimit,
				settings.maxSuffixCharLimit
			)
		);

		const postProcessors: PostProcessor[] = [];
		if (settings.removeDuplicateMathBlockIndicator) {
			postProcessors.push(new RemoveMathIndicators());
		}
		if (settings.removeDuplicateCodeBlockIndicator) {
			postProcessors.push(new RemoveCodeIndicators());
		}

		postProcessors.push(new RemoveOverlap());
		postProcessors.push(new RemoveWhitespace());

		const llm_manager = new LLMManager(settings)
		const model = {
			provider: settings.applyModelProvider,
			modelId: settings.applyModelId,
		}
		const llm = new LLMClient(llm_manager, model);

		return new AutoComplete(
			llm,
			settings.systemMessage,
			formatter,
			settings.chainOfThoughtRemovalRegex,
			preProcessors,
			postProcessors,
			settings.fewShotExamples,
			settings.debugMode,
		);
	}

	async fetchPredictions(
		prefix: string,
		suffix: string
	): Promise<Result<string, Error>> {
		const context: Context = Context.getContext(prefix, suffix);

		for (const preProcessor of this.preProcessors) {
			if (preProcessor.removesCursor(prefix, suffix)) {
				return ok("");
			}

			({ prefix, suffix } = preProcessor.process(
				prefix,
				suffix,
				context
			));
		}

		const examples = this.fewShotExamples.filter(
			(example) => example.context === context
		);
		const fewShotExamplesChatMessages =
			fewShotExamplesToChatMessages(examples);

		const messages: RequestMessage[] = [
			{
				content: this.getSystemMessageFor(context),
				role: "system"
			},
			...fewShotExamplesChatMessages,
			{
				role: "user",
				content: this.userMessageFormatter({
					suffix,
					prefix,
				}),
			},
		];

		if (this.debugMode) {
			console.log("Copilot messages send:\n", messages);
		}

		let result = await this.client.queryChatModel(messages);
		if (this.debugMode && result.isOk()) {
			console.log("Copilot response:\n", result.value);
		}

		result = this.extractAnswerFromChainOfThoughts(result);

		for (const postProcessor of this.postProcessors) {
			result = result.map((r) => postProcessor.process(prefix, suffix, r, context));
		}

		result = this.checkAgainstGuardRails(result);

		return result;
	}

	private getSystemMessageFor(context: Context): string {
		if (context === Context.Text) {
			return this.systemMessage + "\n\n" + "The <mask/> is located in a paragraph. Your answer must complete this paragraph or sentence in a way that fits the surrounding text without overlapping with it. It must be in the same language as the paragraph.";
		}
		if (context === Context.Heading) {
			return this.systemMessage + "\n\n" + "The <mask/> is located in the Markdown heading. Your answer must complete this title in a way that fits the content of this paragraph and be in the same language as the paragraph.";
		}

		if (context === Context.BlockQuotes) {
			return this.systemMessage + "\n\n" + "The <mask/> is located within a quote. Your answer must complete this quote in a way that fits the context of the paragraph.";
		}
		if (context === Context.UnorderedList) {
			return this.systemMessage + "\n\n" + "The <mask/> is located in an unordered list. Your answer must include one or more list items that fit with the surrounding list without overlapping with it.";
		}

		if (context === Context.NumberedList) {
			return this.systemMessage + "\n\n" + "The <mask/> is located in a numbered list. Your answer must include one or more list items that fit the sequence and context of the surrounding list without overlapping with it.";
		}

		if (context === Context.CodeBlock) {
			return this.systemMessage + "\n\n" + "The <mask/> is located in a code block. Your answer must complete this code block in the same programming language and support the surrounding code and text outside of the code block.";
		}
		if (context === Context.MathBlock) {
			return this.systemMessage + "\n\n" + "The <mask/> is located in a math block. Your answer must only contain LaTeX code that captures the math discussed in the surrounding text. No text or explaination only LaTex math code.";
		}
		if (context === Context.TaskList) {
			return this.systemMessage + "\n\n" + "The <mask/> is located in a task list. Your answer must include one or more (sub)tasks that are logical given the other tasks and the surrounding text.";
		}


		return this.systemMessage;

	}

	private extractAnswerFromChainOfThoughts(
		result: Result<string, Error>
	): Result<string, Error> {
		if (result.isErr()) {
			return result;
		}
		const chainOfThoughts = result.value;

		const regex = new RegExp(this.removePreAnswerGenerationRegex, "gm");
		const match = regex.exec(chainOfThoughts);
		if (match === null) {
			return err(new Error("No match found"));
		}
		return ok(chainOfThoughts.replace(regex, ""));
	}

	private checkAgainstGuardRails(
		result: Result<string, Error>
	): Result<string, Error> {
		if (result.isErr()) {
			return result;
		}
		if (result.value.length === 0) {
			return err(new Error("Empty result"));
		}
		if (result.value.contains("<mask/>")) {
			return err(new Error("Mask in result"));
		}

		return result;
	}
}

function fewShotExamplesToChatMessages(
	examples: FewShotExample[]
): ChatMessage[] {
	return examples
		.map((example): ChatMessage[] => {
			return [
				{
					role: "user",
					content: example.input,
				},
				{
					role: "assistant",
					content: example.answer,
				},
			];
		})
		.flat();
}

export default AutoComplete;