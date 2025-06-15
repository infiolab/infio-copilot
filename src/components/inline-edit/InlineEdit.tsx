import { CornerDownLeft } from 'lucide-react';
import { MarkdownView, Plugin } from 'obsidian';
import React, { useEffect, useRef, useState } from 'react';

import { APPLY_VIEW_TYPE } from '../../constants';
import LLMManager from '../../core/llm/manager';
import { t } from '../../lang/helpers';
import { InfioSettings } from '../../types/settings';
import { GetProviderModelIds } from '../../utils/api';
import { ApplyEditToFile } from '../../utils/apply';
import { removeAITags } from '../../utils/content-filter';
import { PromptGenerator } from '../../utils/prompt-generator';
import { onEnt } from '../../utils/web-search';

type InlineEditProps = {
	source?: string;
	secStartLine: number;
	secEndLine: number;
	plugin: Plugin;
	settings: InfioSettings;
}

type InputAreaProps = {
	value: string;
	onChange: (value: string) => void;
	handleSubmit: () => void;
	handleClose: () => void;
}

const InputArea: React.FC<InputAreaProps> = ({ value, onChange, handleSubmit, handleClose }) => {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === 'Enter') {
			if (e.shiftKey) {
				// Shift + Enter: 允许换行，使用默认行为
				return;
			}
			// 普通 Enter: 阻止默认行为并触发提交
			e.preventDefault();
			handleSubmit();
		} else if (e.key === 'Escape') {
			// 当按下 Esc 键时关闭编辑器
			handleClose();
		}
	};

	return (
		<div className="infio-ai-block-input-wrapper">
			<textarea
				ref={textareaRef}
				className="infio-ai-block-content"
				placeholder={t('inlineEdit.placeholder')}
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
			/>
		</div>
	);
};

type ControlAreaProps = {
	settings: InfioSettings;
	onSubmit: () => void;
	selectedModel: string;
	onModelChange: (model: string) => void;
	isSubmitting: boolean;
}

const ControlArea: React.FC<ControlAreaProps> = ({
	settings,
	onSubmit,
	selectedModel,
	onModelChange,
	isSubmitting,
}) => {
	const [providerModels, setProviderModels] = useState<string[]>([]);

	useEffect(() => {
		const fetchModels = async () => {
			try {
				const models = await GetProviderModelIds(settings.chatModelProvider, settings);
				setProviderModels(models);
			} catch (err) {
				const error = err as Error;
				console.error(t("inlineEdit.fetchModelsError"), error.message);
			}
		};
		fetchModels();
	}, [settings]);

	return (
		<div className="infio-ai-block-controls">
			<select
				className="infio-ai-block-model-select"
				value={selectedModel}
				onChange={(e) => onModelChange(e.target.value)}
				disabled={isSubmitting}
			>
				{providerModels.map((modelId) => (
					<option key={modelId} value={modelId}>
						{modelId}
					</option>
				))}
			</select>
			<button
				className="infio-ai-block-submit-button"
				onClick={onSubmit}
				disabled={isSubmitting}
			>
				{isSubmitting ? t("inlineEdit.submitting") : (
					<>
						{t("inlineEdit.submit")}
						<CornerDownLeft size={11} className="infio-ai-block-submit-icon" />
					</>
				)}
			</button>
		</div>);
};

export const InlineEdit: React.FC<InlineEditProps> = ({
	source,
	secStartLine,
	secEndLine,
	plugin,
	settings,
}) => {
	const [instruction, setInstruction] = useState("");
	const [selectedModel, setSelectedModel] = useState(settings.chatModelId);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const llmManager = new LLMManager(settings);

	const promptGenerator = new PromptGenerator(
		async () => {
			throw new Error(t("inlineEdit.ragNotNeeded"));
		},
		plugin.app,
		settings
	);

	const handleClose = () => {
		const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
		if (!activeView?.editor) return;
		activeView.editor.replaceRange(
			"",
			{ line: secStartLine, ch: 0 },
			{ line: secEndLine + 1, ch: 0 }
		);
	};

	const getActiveContext = async () => {
		const activeFile = plugin.app.workspace.getActiveFile();
		if (!activeFile) {
			console.error(t("inlineEdit.noActiveFile"));
			return {};
		}

		const editor = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		if (!editor) {
			console.error(t("inlineEdit.noActiveEditor"));
			return { activeFile };
		}

		const selection = editor.getSelection();
		if (!selection) {
			console.error(t("inlineEdit.noTextSelected"));
			return { activeFile, editor };
		}

		return { activeFile, editor, selection };
	};

	const parseSmartComposeBlock = (content: string) => {
		const match = /<response>([\s\S]*?)<\/response>/.exec(content);
		if (!match) {
			return null;
		}

		const blockContent = match[1].trim();

		return {
			content: blockContent,
		};
	};

	const handleSubmit = async () => {
		setIsSubmitting(true);
		try {
			const { activeFile, editor, selection } = await getActiveContext();
			onEnt('inline-edit-submit')
			if (!activeFile || !editor || !selection) {
				console.error(t("inlineEdit.noActiveContext"));
				setIsSubmitting(false);
				return;
			}

			const chatModel = {
				provider: settings.chatModelProvider,
				modelId: settings.chatModelId,
			};
			if (!chatModel) {
				setIsSubmitting(false);
				throw new Error(t("inlineEdit.invalidChatModel"));
			}

			const from = editor.getCursor("from");
			const to = editor.getCursor("to");
			const defaultStartLine = from.line + 1;
			const defaultEndLine = to.line + 1;

			const requestMessages = await promptGenerator.generateEditMessages({
				currentFile: activeFile,
				selectedContent: selection,
				instruction: instruction,
				startLine: defaultStartLine,
				endLine: defaultEndLine,
			});

			const stream = await llmManager.streamResponse(
				chatModel,
				{
					messages: requestMessages,
					model: chatModel.modelId,
					max_tokens: settings.modelOptions.max_tokens,
					temperature: settings.modelOptions.temperature,
					// top_p: settings.modelOptions.top_p,
					// frequency_penalty: settings.modelOptions.frequency_penalty,
					// presence_penalty: settings.modelOptions.presence_penalty,
					stream: true,
				}
			)

			let response_content = ""
			for await (const chunk of stream) {
				const content = chunk.choices[0]?.delta?.content ?? ''
				response_content += content
			}
			if (!response_content) {
				setIsSubmitting(false);
				throw new Error(t("inlineEdit.emptyLLMResponse"));
			}

			const parsedBlock = parseSmartComposeBlock(
				response_content
			);
			const finalContent = parsedBlock?.content || response_content;

			if (!activeFile || !(activeFile.path && typeof activeFile.path === 'string')) {
				setIsSubmitting(false);
				throw new Error(t("inlineEdit.invalidActiveFile"));
			}

			let fileContent: string;
			try {
				fileContent = await plugin.app.vault.cachedRead(activeFile);
				// 清理null字节，防止PostgreSQL UTF8编码错误
				fileContent = fileContent.replace(/\0/g, '');
			} catch (err) {
				const error = err as Error;
				console.error(t("inlineEdit.readFileError"), error.message);
				setIsSubmitting(false);
				return;
			}

			const updatedContent = await ApplyEditToFile(
				fileContent,
				finalContent,
				defaultStartLine,
				defaultEndLine
			);

			if (!updatedContent) {
				console.error(t("inlineEdit.applyChangesError"));
				setIsSubmitting(false);
				return;
			}

			let oldContent = await plugin.app.vault.read(activeFile);
			// 清理null字节，防止PostgreSQL UTF8编码错误
			oldContent = oldContent.replace(/\0/g, '');
			await plugin.app.workspace.getLeaf(true).setViewState({
				type: APPLY_VIEW_TYPE,
				active: true,
				state: {
					file: activeFile.path,
					oldContent: removeAITags(oldContent),
					newContent: removeAITags(updatedContent),
				},
			});
		} catch (err) {
			const error = err as Error;
			console.error(t("inlineEdit.inlineEditError"), error.message);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<div className="infio-ai-block-container"
			id="infio-ai-block-container"
		>
			<InputArea value={instruction} onChange={setInstruction} handleSubmit={handleSubmit} handleClose={handleClose} />
			<button className="infio-ai-block-close-button" onClick={handleClose}>
				<svg
					width="16"
					height="16"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
				>
					<line x1="18" y1="6" x2="6" y2="18"></line>
					<line x1="6" y1="6" x2="18" y2="18"></line>
				</svg>
			</button>
			<ControlArea
				settings={settings}
				onSubmit={handleSubmit}
				selectedModel={selectedModel}
				onModelChange={setSelectedModel}
				isSubmitting={isSubmitting}
			/>
		</div>
	);
};
