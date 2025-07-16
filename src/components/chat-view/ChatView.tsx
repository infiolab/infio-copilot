import * as path from 'path'

import { BaseSerializedNode } from '@lexical/clipboard/clipboard'
import { useMutation } from '@tanstack/react-query'
import { Box, CircleStop, History, Lightbulb, NotebookPen, Plus, Search, Server, SquareSlash, Undo } from 'lucide-react'
import { App, Notice, TFile, TFolder, WorkspaceLeaf } from 'obsidian'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react'
import { v4 as uuidv4 } from 'uuid'

import { ApplyView, ApplyViewState } from '../../ApplyView'
import { APPLY_VIEW_TYPE } from '../../constants'
import { useApp } from '../../contexts/AppContext'
import { useDataview } from '../../contexts/DataviewContext'
import { useDiffStrategy } from '../../contexts/DiffStrategyContext'
import { useLLM } from '../../contexts/LLMContext'
import { useMcpHub } from '../../contexts/McpHubContext'
import { useRAG } from '../../contexts/RAGContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useTrans } from '../../contexts/TransContext'
import { matchSearchUsingCorePlugin } from '../../core/file-search/match/coreplugin-match'
import { matchSearchUsingOmnisearch } from '../../core/file-search/match/omnisearch-match'
import { regexSearchUsingCorePlugin } from '../../core/file-search/regex/coreplugin-regex'
import { regexSearchUsingRipgrep } from '../../core/file-search/regex/ripgrep-regex'
import {
	LLMAPIKeyInvalidException,
	LLMAPIKeyNotSetException,
	LLMBaseUrlNotSetException,
	LLMModelNotSetException,
} from '../../core/llm/exception'
import { TransformationType } from '../../core/transformations/trans-engine'
import { Workspace } from '../../database/json/workspace/types'
import { WorkspaceManager } from '../../database/json/workspace/WorkspaceManager'
import { useChatHistory } from '../../hooks/use-chat-history'
import { useCustomModes } from '../../hooks/use-custom-mode'
import { t } from '../../lang/helpers'
import { PreviewView } from '../../PreviewView'
import useChatStore from '../../stores/chat-store'
import { ApplyStatus, ToolArgs } from '../../types/apply'
import { ChatMessage, ChatUserMessage } from '../../types/chat'
import {
	Mentionable,
	MentionableBlock,
	MentionableBlockData,
	MentionableCurrentFile,
} from '../../types/mentionable'
import { ApplyEditToFile, SearchAndReplace } from '../../utils/apply'
import { listFilesAndFolders, semanticSearchFiles } from '../../utils/glob-utils'
import {
	getMentionableKey,
	serializeMentionable,
} from '../../utils/mentionable'
import { readTFileContent, readTFileContentPdf } from '../../utils/obsidian'
import { openSettingsModalWithError } from '../../utils/open-settings-modal'
import { PromptGenerator, addLineNumbers } from '../../utils/prompt-generator'
// Removed empty line above, added one below for group separation
import { fetchUrlsContent, onEnt, webSearch } from '../../utils/web-search'
import ErrorBoundary from '../common/ErrorBoundary'

import PromptInputWithActions, { ChatUserInputRef } from './chat-input/PromptInputWithActions'
import { editorStateToPlainText } from './chat-input/utils/editor-state-to-plain-text'
import ChatHistoryView from './ChatHistoryView'
import CommandsView from './CommandsView'
import CustomModeView from './CustomModeView'
import FileReadResults from './FileReadResults'
import HelloInfo from './HelloInfo'
import InsightView from './InsightView'
import MarkdownReasoningBlock from './Markdown/MarkdownReasoningBlock'
import McpHubView from './McpHubView'; // Moved after MarkdownReasoningBlock
import QueryProgress, { QueryProgressState } from './QueryProgress'
import ReactMarkdown from './ReactMarkdown'
import SearchView from './SearchView'
import SimilaritySearchResults from './SimilaritySearchResults'
import UserMessageView from './UserMessageView'
import WebsiteReadResults from './WebsiteReadResults'
import WorkspaceSelect from './WorkspaceSelect'
import WorkspaceView from './WorkspaceView'

// Add an empty line here
const getNewInputMessage = (app: App, defaultMention: string): ChatUserMessage => {
	const mentionables: Mentionable[] = [];
	if (defaultMention === 'current-file') {
		const activeFile = app.workspace.getActiveFile();
		if (activeFile) {
			mentionables.push({
				type: 'current-file',
				file: activeFile,
			});
		}
	} else if (defaultMention === 'vault') {
		mentionables.push({
			type: 'vault',
		});
	}
	return {
		role: 'user',
		applyStatus: ApplyStatus.Idle,
		content: null,
		promptContent: null,
		id: uuidv4(),
		mentionables: mentionables,
	}
}

export type ChatRef = {
	openNewChat: (selectedBlock?: MentionableBlockData) => void
	addSelectionToChat: (selectedBlock: MentionableBlockData) => void
	focusMessage: () => void
}

export type ChatProps = {
	selectedBlock?: MentionableBlockData
}

const Chat = forwardRef<ChatRef, ChatProps>((props, ref) => {
	const app = useApp()
	const { settings, setSettings } = useSettings()
	const { getRAGEngine } = useRAG()
	const { getTransEngine } = useTrans()
	const diffStrategy = useDiffStrategy()
	const dataviewManager = useDataview()
	const { getMcpHub } = useMcpHub()
	const { customModeList, customModePrompts } = useCustomModes()

	const {
		createOrUpdateConversation,
		deleteConversation,
		getChatMessagesById,
		updateConversationTitle,
		chatList,
	} = useChatHistory()
	const { streamResponse, chatModel } = useLLM()
	
	// 使用全局状态管理
	const {
		currentConversationId: storeConversationId,
		setCurrentConversationId: setStoreConversationId,
		currentTab: tab,
		setCurrentTab: setTab,
		shouldAutoLoadLastChat,
		setShouldAutoLoadLastChat,
	} = useChatStore()

	const promptGenerator = useMemo(() => {
		// @ts-expect-error TODO: Review PromptGenerator constructor parameters and types
		return new PromptGenerator(getRAGEngine, app, settings, diffStrategy, customModePrompts, customModeList, getMcpHub)
	}, [getRAGEngine, app, settings, diffStrategy, customModePrompts, customModeList, getMcpHub])

	const workspaceManager = useMemo(() => {
		return new WorkspaceManager(app)
	}, [app])

	const [inputMessage, setInputMessage] = useState<ChatUserMessage>(() => {
		const newMessage = getNewInputMessage(app, settings.defaultMention)
		if (props.selectedBlock) {
			newMessage.mentionables = [
				...newMessage.mentionables,
				{
					type: 'block',
					...props.selectedBlock,
				},
			]
		}
		return newMessage
	})
	const [addedBlockKey, setAddedBlockKey] = useState<string | null>(
		props.selectedBlock
			? getMentionableKey(
				serializeMentionable({
					type: 'block',
					...props.selectedBlock,
				}),
			)
			: null,
	)
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
	const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null)
	
	// 当前对话ID，初始化时总是生成新的
	const [currentConversationId, setCurrentConversationId] = useState<string>(uuidv4())
	
	// 初始化加载状态
	const [isInitialLoading, setIsInitialLoading] = useState<boolean>(
		shouldAutoLoadLastChat && !!storeConversationId
	)
	
	const [queryProgress, setQueryProgress] = useState<QueryProgressState>({
		type: 'idle',
	})

	const preventAutoScrollRef = useRef(false)
	const lastProgrammaticScrollRef = useRef<number>(0)
	const activeStreamAbortControllersRef = useRef<AbortController[]>([])
	const chatUserInputRefs = useRef<Map<string, ChatUserInputRef>>(new Map())
	const chatMessagesRef = useRef<HTMLDivElement>(null)
	const registerChatUserInputRef = (
		id: string,
		ref: ChatUserInputRef | null,
	) => {
		if (ref) {
			chatUserInputRefs.current.set(id, ref)
		} else {
			chatUserInputRefs.current.delete(id)
		}
	}

	const [selectedSerializedNodes, setSelectedSerializedNodes] = useState<BaseSerializedNode[]>([])

	// 跟踪正在编辑的消息ID
	const [editingMessageId, setEditingMessageId] = useState<string | null>(null)

	useEffect(() => {
		const scrollContainer = chatMessagesRef.current
		if (!scrollContainer) return

		const handleScroll = () => {
			// If the scroll event happened very close to our programmatic scroll, ignore it
			if (Date.now() - lastProgrammaticScrollRef.current < 50) {
				return
			}

			preventAutoScrollRef.current =
				scrollContainer.scrollHeight -
				scrollContainer.scrollTop -
				scrollContainer.clientHeight >
				20
		}

		scrollContainer.addEventListener('scroll', handleScroll)
		return () => scrollContainer.removeEventListener('scroll', handleScroll)
	}, [chatMessages])


	useEffect(() => {
		onEnt(`switch_tab/${tab}`)
	}, [tab])

	const handleCreateCommand = (serializedNodes: BaseSerializedNode[]) => {
		setSelectedSerializedNodes(serializedNodes)
		setTab('commands')
	}

	const handleScrollToBottom = () => {
		if (chatMessagesRef.current) {
			const scrollContainer = chatMessagesRef.current
			if (scrollContainer.scrollTop !== scrollContainer.scrollHeight) {
				lastProgrammaticScrollRef.current = Date.now()
				scrollContainer.scrollTop = scrollContainer.scrollHeight
			}
		}
	}

	const abortActiveStreams = () => {
		for (const abortController of activeStreamAbortControllersRef.current) {
			abortController.abort()
		}
		activeStreamAbortControllersRef.current = []
	}

	const handleLoadConversation = useCallback(async (conversationId: string) => {
		try {
			abortActiveStreams()
			const conversation = await getChatMessagesById(conversationId)
			if (!conversation) {
				throw new Error(String(t('chat.errors.conversationNotFound')))
			}
			setCurrentConversationId(conversationId)
			setStoreConversationId(conversationId) // 同步更新到store
			setChatMessages(conversation)
			const newInputMessage = getNewInputMessage(app, settings.defaultMention)
			setInputMessage(newInputMessage)
			setFocusedMessageId(newInputMessage.id)
			setQueryProgress({
				type: 'idle',
			})
		} catch (error) {
			new Notice(String(t('chat.errors.failedToLoadConversation')))
			console.error(String(t('chat.errors.failedToLoadConversation')), error)
		}
	}, [app, settings.defaultMention, getChatMessagesById, setStoreConversationId])

	const handleNewChat = useCallback((selectedBlock?: MentionableBlockData) => {
		const newConversationId = uuidv4()
		setCurrentConversationId(newConversationId)
		// 清除store中的对话ID，避免重新打开时自动加载之前的对话
		setStoreConversationId(null)
		// 结束初始化加载状态
		setIsInitialLoading(false)
		setChatMessages([])
		const newInputMessage = getNewInputMessage(app, settings.defaultMention)
		if (selectedBlock) {
			const mentionableBlock: MentionableBlock = {
				type: 'block',
				...selectedBlock,
			}
			newInputMessage.mentionables = [
				...newInputMessage.mentionables,
				mentionableBlock,
			]
			setAddedBlockKey(
				getMentionableKey(serializeMentionable(mentionableBlock)),
			)
		}
		setInputMessage(newInputMessage)
		setFocusedMessageId(newInputMessage.id)
		setQueryProgress({
			type: 'idle',
		})
		abortActiveStreams()
	}, [app, settings.defaultMention, setStoreConversationId])

	const submitMutation = useMutation({
		mutationFn: async ({
			newChatHistory,
			useVaultSearch,
		}: {
			newChatHistory: ChatMessage[]
			useVaultSearch?: boolean
		}) => {
			abortActiveStreams()
			setQueryProgress({
				type: 'idle',
			})

			const responseMessageId = uuidv4()

			try {
				const abortController = new AbortController()
				activeStreamAbortControllersRef.current.push(abortController)
				onEnt('chat-submit')
				const { requestMessages, compiledMessages } =
					await promptGenerator.generateRequestMessages({
						messages: newChatHistory,
						useVaultSearch,
						onQueryProgressChange: setQueryProgress,
					})
				setQueryProgress({
					type: 'idle',
				})

				setChatMessages([
					...compiledMessages,
					{
						role: 'assistant',
						applyStatus: ApplyStatus.Idle,
						content: '',
						reasoningContent: '',
						id: responseMessageId,
						metadata: {
							usage: undefined,
							model: undefined,
						},
					},
				])
				const stream = await streamResponse(
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
					},
					{
						signal: abortController.signal,
					},
				)

				for await (const chunk of stream) {
					const content = chunk.choices[0]?.delta?.content ?? ''
					const reasoning_content = chunk.choices[0]?.delta?.reasoning_content ?? ''
					setChatMessages((prevChatHistory) =>
						prevChatHistory.map((message) =>
							message.role === 'assistant' && message.id === responseMessageId
								? {
									...message,
									content: message.content + content,
									reasoningContent: message.reasoningContent + reasoning_content,
									metadata: {
										...message.metadata,
										usage: chunk.usage ?? message.metadata?.usage, // Keep existing usage if chunk has no usage data
										model: chatModel,
									},
								}
								: message,
						),
					)
					if (!preventAutoScrollRef.current) {
						handleScrollToBottom()
					}
				}
			} catch (error) {
				if (error.name === 'AbortError') {
					return
				} else {
					throw error
				}
			}
		},
		onError: (error) => {
			setQueryProgress({
				type: 'idle',
			})
			if (
				error instanceof LLMAPIKeyNotSetException ||
				error instanceof LLMAPIKeyInvalidException ||
				error instanceof LLMBaseUrlNotSetException ||
				error instanceof LLMModelNotSetException
			) {
				openSettingsModalWithError(app, error.message)
			} else {
				new Notice(error.message)
				console.error('Failed to generate response', error)
			}
		},
	})

	const handleSubmit = (
		newChatHistory: ChatMessage[],
		useVaultSearch?: boolean,
	) => {
		// 当用户真正发送消息时，更新store中的conversation ID
		setStoreConversationId(currentConversationId)
		submitMutation.mutate({ newChatHistory, useVaultSearch })
	}

	const applyMutation = useMutation<
		{
			type: string;
			applyMsgId: string;
			applyStatus: ApplyStatus;
			returnMsg?: ChatUserMessage
		},
		Error,
		{ applyMsgId: string, toolArgs: ToolArgs }
	>({
		mutationFn: async ({ applyMsgId, toolArgs }) => {
			try {
				let opFile = app.workspace.getActiveFile()
				if ('filepath' in toolArgs && toolArgs.filepath) {
					opFile = app.vault.getFileByPath(toolArgs.filepath)
				}
				if (toolArgs.type === 'write_to_file') {
					let newFile = false
					if (!opFile) {
						// 确保目录结构存在
						const dir = path.dirname(toolArgs.filepath)
						if (dir && dir !== '.' && dir !== '/') {
							const dirExists = await app.vault.adapter.exists(dir)
							if (!dirExists) {
								await app.vault.adapter.mkdir(dir)
							}
						}
						opFile = await app.vault.create(toolArgs.filepath, '')
						newFile = true
					}
					// return a Promise, which will be resolved after user makes a choice
					return new Promise<{ type: string; applyMsgId: string; applyStatus: ApplyStatus; returnMsg?: ChatUserMessage }>((resolve) => {
						app.workspace.getLeaf(true).setViewState({
							type: APPLY_VIEW_TYPE,
							active: true,
							state: {
								file: opFile.path,
								oldContent: '',
								newContent: toolArgs.content,
								onClose: (applied: boolean) => {
									const applyStatus = applied ? ApplyStatus.Applied : ApplyStatus.Rejected
									const applyEditContent = applied ? 'Changes successfully applied'
										: 'User rejected changes'
									if (newFile) {
										if (!applied) {
											app.vault.delete(opFile) // delete the new file if user rejected changes
										} else {
											app.workspace.openLinkText(toolArgs.filepath, 'split', true)
										}
									}
									resolve({
										type: toolArgs.type,
										applyMsgId,
										applyStatus,
										returnMsg: {
											role: 'user',
											applyStatus: ApplyStatus.Idle,
											content: null,
											promptContent: `[${toolArgs.type} for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
											id: uuidv4(),
											mentionables: [],
										}
									});
								}
							} satisfies ApplyViewState,
						})
					})
				} else if (toolArgs.type === 'insert_content') {
					if (!opFile) {
						throw new Error(`File not found: ${toolArgs.filepath}`)
					}
					const fileContent = await readTFileContent(opFile, app.vault)
					const appliedFileContent = await ApplyEditToFile(
						fileContent,
						toolArgs.content,
						toolArgs.startLine,
						toolArgs.endLine
					)
					if (!appliedFileContent) {
						throw new Error('Failed to apply edit changes')
					}
					// return a Promise, which will be resolved after user makes a choice
					return new Promise<{ type: string; applyMsgId: string; applyStatus: ApplyStatus; returnMsg?: ChatUserMessage }>((resolve) => {
						app.workspace.getLeaf(true).setViewState({
							type: APPLY_VIEW_TYPE,
							active: true,
							state: {
								file: opFile.path,
								oldContent: fileContent,
								newContent: appliedFileContent,
								onClose: (applied: boolean) => {
									const applyStatus = applied ? ApplyStatus.Applied : ApplyStatus.Rejected
									const applyEditContent = applied ? 'Changes successfully applied'
										: 'User rejected changes'
									resolve({
										type: toolArgs.type,
										applyMsgId,
										applyStatus,
										returnMsg: {
											role: 'user',
											applyStatus: ApplyStatus.Idle,
											content: null,
											promptContent: `[${toolArgs.type} for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
											id: uuidv4(),
											mentionables: [],
										}
									});
								}
							} satisfies ApplyViewState,
						})
					})
				} else if (toolArgs.type === 'search_and_replace') {
					if (!opFile) {
						throw new Error(`File not found: ${toolArgs.filepath}`)
					}
					const fileContent = await readTFileContent(opFile, app.vault)
					const appliedFileContent = await SearchAndReplace(
						fileContent,
						toolArgs.operations
					)
					if (!appliedFileContent) {
						throw new Error('Failed to search_and_replace')
					}
					// return a Promise, which will be resolved after user makes a choice
					return new Promise<{ type: string; applyMsgId: string; applyStatus: ApplyStatus; returnMsg?: ChatUserMessage }>((resolve) => {
						app.workspace.getLeaf(true).setViewState({
							type: APPLY_VIEW_TYPE,
							active: true,
							state: {
								file: opFile.path,
								oldContent: fileContent,
								newContent: appliedFileContent,
								onClose: (applied: boolean) => {
									const applyStatus = applied ? ApplyStatus.Applied : ApplyStatus.Rejected
									const applyEditContent = applied ? 'Changes successfully applied'
										: 'User rejected changes'
									resolve({
										type: 'search_and_replace',
										applyMsgId,
										applyStatus,
										returnMsg: {
											role: 'user',
											applyStatus: ApplyStatus.Idle,
											content: null,
											promptContent: `[search_and_replace for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
											id: uuidv4(),
											mentionables: [],
										}
									});
								}
							} satisfies ApplyViewState,
						})
					})
				} else if (toolArgs.type === 'apply_diff') {
					if (!opFile) {
						throw new Error(`File not found: ${toolArgs.filepath}`)
					}
					const fileContent = await readTFileContent(opFile, app.vault)
					const appliedResult = await diffStrategy.applyDiff(
						fileContent,
						toolArgs.diff
					)
					if (!appliedResult || !appliedResult.success) {
						throw new Error(`Failed to apply_diff`)
					}
					// return a Promise, which will be resolved after user makes a choice
					return new Promise<{ type: string; applyMsgId: string; applyStatus: ApplyStatus; returnMsg?: ChatUserMessage }>((resolve) => {
						app.workspace.getLeaf(true).setViewState({
							type: APPLY_VIEW_TYPE,
							active: true,
							state: {
								file: opFile.path,
								oldContent: fileContent,
								newContent: appliedResult.content,
								onClose: (applied: boolean) => {
									const applyStatus = applied ? ApplyStatus.Applied : ApplyStatus.Rejected
									const applyEditContent = applied ? 'Changes successfully applied'
										: 'User rejected changes'
									resolve({
										type: 'apply_diff',
										applyMsgId,
										applyStatus,
										returnMsg: {
											role: 'user',
											applyStatus: ApplyStatus.Idle,
											content: null,
											promptContent: `[apply_diff for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
											id: uuidv4(),
											mentionables: [],
										}
									});
								}
							} satisfies ApplyViewState,
						})
					})
				} else if (toolArgs.type === 'read_file') {
					if (!opFile) {
						throw new Error(`File not found: ${toolArgs.filepath}`)
					}
					const fileContent = await readTFileContentPdf(opFile, app.vault, app)
					const formattedContent = `[read_file for '${toolArgs.filepath}'] Result:\n${addLineNumbers(fileContent)}\n`;
					return {
						type: 'read_file',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					};
				} else if (toolArgs.type === 'list_files') {
					// 获取当前工作区
					let currentWorkspace: Workspace | null = null
					if (settings.workspace && settings.workspace !== 'vault') {
						currentWorkspace = await workspaceManager.findByName(String(settings.workspace))
					}

					const files = await listFilesAndFolders(
						app.vault,
						toolArgs.filepath,
						toolArgs.recursive,
						currentWorkspace || undefined,
						app
					)

					const contextInfo = currentWorkspace
						? `workspace '${currentWorkspace.name}'`
						: toolArgs.filepath || 'vault root'
					const formattedContent = `[list_files for '${contextInfo}'] Result:\n${files.join('\n')}\n`;
					return {
						type: 'list_files',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'match_search_files') {
					const searchBackend = settings.filesSearchSettings.matchBackend
					let results: string;
					if (searchBackend === 'omnisearch') {
						results = await matchSearchUsingOmnisearch(toolArgs.query, app)
					} else {
						results = await matchSearchUsingCorePlugin(toolArgs.query, app)
					}
					const formattedContent = `[match_search_files for '${toolArgs.filepath}'] Result:\n${results}\n`;
					return {
						type: 'match_search_files',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'regex_search_files') {
					const searchBackend = settings.filesSearchSettings.regexBackend
					let results: string;
					if (searchBackend === 'coreplugin') {
						results = await regexSearchUsingCorePlugin(toolArgs.regex, app)
					} else {
						// @ts-expect-error Obsidian API type mismatch
						const baseVaultPath = String(app.vault.adapter.getBasePath())
						const absolutePath = path.join(baseVaultPath, toolArgs.filepath)
						const ripgrepPath = settings.filesSearchSettings.ripgrepPath
						results = await regexSearchUsingRipgrep(absolutePath, toolArgs.regex, ripgrepPath)
					}
					const formattedContent = `[regex_search_files for '${toolArgs.filepath}'] Result:\n${results}\n`;
					return {
						type: 'regex_search_files',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'semantic_search_files') {
					// 获取当前工作区
					let currentWorkspace: Workspace | null = null
					if (settings.workspace && settings.workspace !== 'vault') {
						currentWorkspace = await workspaceManager.findByName(String(settings.workspace))
					}

					const snippets = await semanticSearchFiles(
						await getRAGEngine(),
						toolArgs.query,
						toolArgs.filepath,
						currentWorkspace || undefined,
						app,
						await getTransEngine()
					)

					const contextInfo = currentWorkspace
						? `workspace '${currentWorkspace.name}'`
						: toolArgs.filepath || 'vault'
					const formattedContent = `[semantic_search_files for '${contextInfo}'] Result:\n${snippets}\n`;
					return {
						type: 'semantic_search_files',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'search_web') {
					const results = await webSearch(
						toolArgs.query,
						settings.serperApiKey,
						settings.serperSearchEngine,
						settings.jinaApiKey,
						(await getRAGEngine())
					)
					const formattedContent = `[search_web for '${toolArgs.query}'] Result:\n${results}\n`;
					return {
						type: 'search_web',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'fetch_urls_content') {
					const results = await fetchUrlsContent(toolArgs.urls, settings.jinaApiKey)
					const formattedContent = `[ fetch_urls_content ] Result:\n${results}\n`;
					return {
						type: 'fetch_urls_content',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'switch_mode') {
					setSettings({
						...settings,
						mode: toolArgs.mode,
					})
					const formattedContent = `[switch_mode to ${toolArgs.mode}] Result: successfully switched to ${toolArgs.mode}\n`
					return {
						type: 'switch_mode',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'use_mcp_tool') {
					const mcpHub = await getMcpHub()
					if (!mcpHub) {
						throw new Error('MCP hub not found')
					}
					const toolResult = await mcpHub.callTool(toolArgs.server_name, toolArgs.tool_name, toolArgs.parameters)
					const toolResultPretty =
						(toolResult?.isError ? "Error:\n" : "") +
						toolResult?.content
							.map((item) => {
								if (item.type === "text") {
									return item.text
								}
								if (item.type === "resource") {
									// eslint-disable-next-line @typescript-eslint/no-unused-vars
									const { blob, ...rest } = item.resource
									return JSON.stringify(rest, null, 2)
								}
								return ""
							})
							.filter(Boolean)
							.join("\n\n") || "(No response)"

					const formattedContent = `[use_mcp_tool for '${toolArgs.server_name}'] Result:\n${toolResultPretty}\n`;
					return {
						type: 'use_mcp_tool',
						applyMsgId,
						applyStatus: ApplyStatus.Applied,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'dataview_query') {
					if (!dataviewManager) {
						throw new Error('DataviewManager 未初始化')
					}

					if (!dataviewManager.isDataviewAvailable()) {
						throw new Error('Dataview 插件未安装或未启用，请先安装并启用 Dataview 插件')
					}

					// 执行 Dataview 查询
					const result = await dataviewManager.executeQuery(toolArgs.query)

					let formattedContent: string;
					if (result.success) {
						formattedContent = `[dataview_query] 查询成功:\n${result.data}`;
					} else {
						formattedContent = `[dataview_query] 查询失败:\n${result.error}`;
					}

					return {
						type: 'dataview_query',
						applyMsgId,
						applyStatus: result.success ? ApplyStatus.Applied : ApplyStatus.Failed,
						returnMsg: {
							role: 'user',
							applyStatus: ApplyStatus.Idle,
							content: null,
							promptContent: formattedContent,
							id: uuidv4(),
							mentionables: [],
						}
					}
				} else if (toolArgs.type === 'call_transformations') {
					// Handling for the unified transformations tool
					try {
						console.log("call_transformations", toolArgs)
						// Validate that the transformation type is a valid enum member
						const validTransformationTypes = Object.values(TransformationType)
						const transformationType = toolArgs.transformation
						if (!validTransformationTypes.includes(transformationType)) {
							throw new Error(`Unsupported transformation type: ${transformationType}`);
						}

						const transEngine = await getTransEngine();

						// Execute the transformation using the TransEngine
						const transformationResult = await transEngine.runTransformation({
							filePath: toolArgs.path,
							transformationType: transformationType,
							model: {
								provider: settings.applyModelProvider,
								modelId: settings.applyModelId,
							},
							saveToDatabase: true
						});

						if (!transformationResult.success) {
							throw new Error(transformationResult.error || 'Transformation failed');
						}

						// Build the result message
						let formattedContent = `[${toolArgs.transformation}] transformation complete:\n\n${transformationResult.result}`;

						if (transformationResult.truncated) {
							formattedContent += `\n\n*Note: The original content was too long (${transformationResult.originalTokens} tokens) and was truncated to ${transformationResult.processedTokens} tokens for processing.*`;
						}

						return {
							type: toolArgs.type,
							applyMsgId,
							applyStatus: ApplyStatus.Applied,
							returnMsg: {
								role: 'user',
								applyStatus: ApplyStatus.Idle,
								content: null,
								promptContent: formattedContent,
								id: uuidv4(),
								mentionables: [],
							}
						};
					} catch (error) {
						console.error(`Transformation failed (${toolArgs.transformation}):`, error);
						return {
							type: toolArgs.type,
							applyMsgId,
							applyStatus: ApplyStatus.Failed,
							returnMsg: {
								role: 'user',
								applyStatus: ApplyStatus.Idle,
								content: null,
								promptContent: `[${toolArgs.transformation}] transformation failed: ${error instanceof Error ? error.message : String(error)}`,
								id: uuidv4(),
								mentionables: [],
							}
						};
					}
				} else if (toolArgs.type === 'manage_files') {
					try {
						const results: string[] = [];

						// 处理每个文件操作
						for (const operation of toolArgs.operations) {
							switch (operation.action) {
								case 'create_folder':
									if (operation.path) {
										const folderExists = await app.vault.adapter.exists(operation.path);
										if (!folderExists) {
											await app.vault.adapter.mkdir(operation.path);
											results.push(`✅ 成功创建文件夹: ${operation.path}`);
										} else {
											results.push(`⚠️ 文件夹已存在: ${operation.path}`);
										}
									}
									break;

								case 'move':
									if (operation.source_path && operation.destination_path) {
										// 使用 getAbstractFileByPath 而不是 getFileByPath，这样可以获取文件和文件夹
										const sourceFile = app.vault.getAbstractFileByPath(operation.source_path);
										if (sourceFile) {
											// 确保目标目录存在
											const destDir = path.dirname(operation.destination_path);
											if (destDir && destDir !== '.' && destDir !== '/') {
												const dirExists = await app.vault.adapter.exists(destDir);
												if (!dirExists) {
													await app.vault.adapter.mkdir(destDir);
												}
											}
											await app.vault.rename(sourceFile, operation.destination_path);
											const itemType = sourceFile instanceof TFile ? '文件' : '文件夹';
											results.push(`✅ 成功移动${itemType}: ${operation.source_path} → ${operation.destination_path}`);
										} else {
											results.push(`❌ 源文件或文件夹不存在: ${operation.source_path}`);
										}
									}
									break;

								case 'delete':
									if (operation.path) {
										// 使用 getAbstractFileByPath 而不是 getFileByPath
										const fileOrFolder = app.vault.getAbstractFileByPath(operation.path);
										if (fileOrFolder) {
											try {
												const isFolder = fileOrFolder instanceof TFolder;
												// 使用 trash 方法将文件/文件夹移到回收站，更安全
												// system: true 尝试使用系统回收站，失败则使用 Obsidian 本地回收站
												await app.vault.trash(fileOrFolder, true);
												const itemType = isFolder ? '文件夹' : '文件';
												results.push(`✅ 成功将${itemType}移到回收站: ${operation.path}`);
											} catch (error) {
												console.error('删除失败:', error);
												results.push(`❌ 删除失败: ${operation.path} - ${error.message}`);
											}
										} else {
											results.push(`❌ 文件或文件夹不存在: ${operation.path}`);
										}
									}
									break;

								case 'copy':
									if (operation.source_path && operation.destination_path) {
										// 文件夹复制比较复杂，需要递归处理
										const sourceFile = app.vault.getAbstractFileByPath(operation.source_path);
										if (sourceFile) {
											if (sourceFile instanceof TFile) {
												// 文件复制
												const destDir = path.dirname(operation.destination_path);
												if (destDir && destDir !== '.' && destDir !== '/') {
													const dirExists = await app.vault.adapter.exists(destDir);
													if (!dirExists) {
														await app.vault.adapter.mkdir(destDir);
													}
												}
												const content = await app.vault.read(sourceFile);
												await app.vault.create(operation.destination_path, content);
												results.push(`✅ 成功复制文件: ${operation.source_path} → ${operation.destination_path}`);
											} else if (sourceFile instanceof TFolder) {
												// 文件夹复制需要递归处理
												results.push(`❌ 文件夹复制功能暂未实现: ${operation.source_path}`);
											}
										} else {
											results.push(`❌ 源文件或文件夹不存在: ${operation.source_path}`);
										}
									}
									break;

								case 'rename':
									if (operation.path && operation.new_name) {
										// 使用 getAbstractFileByPath 而不是 getFileByPath
										const file = app.vault.getAbstractFileByPath(operation.path);
										if (file) {
											const newPath = path.join(path.dirname(operation.path), operation.new_name);
											await app.vault.rename(file, newPath);
											const itemType = file instanceof TFile ? '文件' : '文件夹';
											results.push(`✅ 成功重命名${itemType}: ${operation.path} → ${newPath}`);
										} else {
											results.push(`❌ 文件或文件夹不存在: ${operation.path}`);
										}
									}
									break;

								default:
									results.push(`❌ 不支持的操作类型: ${String(operation.action)}`);
							}
						}

						const formattedContent = `[manage_files] 文件管理操作结果:\n${results.join('\n')}`;

						return {
							type: 'manage_files',
							applyMsgId,
							applyStatus: ApplyStatus.Applied,
							returnMsg: {
								role: 'user',
								applyStatus: ApplyStatus.Idle,
								content: null,
								promptContent: formattedContent,
								id: uuidv4(),
								mentionables: [],
							}
						};
					} catch (error) {
						console.error('文件管理操作失败:', error);
						return {
							type: 'manage_files',
							applyMsgId,
							applyStatus: ApplyStatus.Failed,
							returnMsg: {
								role: 'user',
								applyStatus: ApplyStatus.Idle,
								content: null,
								promptContent: `[manage_files] 文件管理操作失败: ${error instanceof Error ? error.message : String(error)}`,
								id: uuidv4(),
								mentionables: [],
							}
						};
					}
				} else {
					// 处理未知的工具类型
					throw new Error(`Unsupported tool type: ${String(toolArgs?.type) || 'unknown'}`);
				}
			} catch (error) {
				console.error('Failed to apply changes', error)
				throw error
			}
		},
		onSuccess: (result) => {
			if (result.applyMsgId || result.returnMsg) {
				let newChatMessages = [...chatMessages];

				if (result.applyMsgId) {
					newChatMessages = newChatMessages.map((message) =>
						message.role === 'assistant' && message.id === result.applyMsgId ? {
							...message,
							applyStatus: result.applyStatus
						} : message,
					);
				}
				if (result.returnMsg) {
					newChatMessages.push({
						id: uuidv4(),
						role: 'assistant',
						applyStatus: ApplyStatus.Idle,
						isToolResult: true,
						content: `<tool_result>${typeof result.returnMsg.promptContent === 'string' ? result.returnMsg.promptContent : ''}</tool_result>`,
						reasoningContent: '',
						metadata: {
							usage: undefined,
							model: undefined,
						},
					})
				}
				setChatMessages(newChatMessages);

				if (result.returnMsg) {
					handleSubmit([...newChatMessages, result.returnMsg], false);
				}
			}
		},
		onError: (error) => {
			if (
				error instanceof LLMAPIKeyNotSetException ||
				error instanceof LLMAPIKeyInvalidException ||
				error instanceof LLMBaseUrlNotSetException ||
				error instanceof LLMModelNotSetException
			) {
				openSettingsModalWithError(app, error.message)
			} else {
				new Notice(error.message)
				console.error('Failed to apply changes', error)
			}
		},
	})

	const handleApply = useCallback(
		(applyMsgId: string, toolArgs: ToolArgs) => {
			applyMutation.mutate({ applyMsgId, toolArgs })
		},
		[applyMutation],
	)

	useEffect(() => {
		setFocusedMessageId(inputMessage.id)
		// 初始化当前活动文件引用
		currentActiveFileRef.current = app.workspace.getActiveFile()
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])
	
	// 自动加载上次的聊天记录
	useEffect(() => {
		const autoLoadLastChat = async () => {
			if (shouldAutoLoadLastChat && storeConversationId && chatMessages.length === 0) {
				try {
					// 检查聊天记录是否存在
					const conversation = await getChatMessagesById(storeConversationId)
					if (conversation && conversation.length > 0) {
						await handleLoadConversation(storeConversationId)
					} else {
						// 如果聊天记录不存在，清除store中的ID
						setStoreConversationId(null)
					}
				} catch (error) {
					console.error('自动加载聊天记录失败:', error)
					// 加载失败时清除store中的ID
					setStoreConversationId(null)
				} finally {
					// 无论成功或失败，都结束初始化加载状态
					setIsInitialLoading(false)
					setShouldAutoLoadLastChat(false) // 避免重复加载
				}
			} else {
				// 如果不需要自动加载，立即结束初始化加载状态
				setIsInitialLoading(false)
			}
		}
		
		autoLoadLastChat()
	}, [storeConversationId, shouldAutoLoadLastChat, chatMessages.length, getChatMessagesById, handleLoadConversation, setStoreConversationId, setShouldAutoLoadLastChat])
	
	// 组件卸载时重置shouldAutoLoadLastChat标志
	useEffect(() => {
		return () => {
			setShouldAutoLoadLastChat(true)
		}
	}, [setShouldAutoLoadLastChat])

	useEffect(() => {
		const updateConversationAsync = async () => {
			try {
				if (chatMessages.length > 0) {
					createOrUpdateConversation(currentConversationId, chatMessages)
				}
			} catch (error) {
				new Notice('Failed to save chat history')
				console.error('Failed to save chat history', error)
			}
		}
		updateConversationAsync()
	}, [currentConversationId, chatMessages, createOrUpdateConversation])

	// 保存当前活动文件的引用，用于比较是否真的发生了变化
	const currentActiveFileRef = useRef<TFile | null>(null)

	// Updates the currentFile of the focused message (input or chat history)
	// This happens when active file changes or focused message changes
	const handleActiveLeafChange = useCallback((leaf: WorkspaceLeaf | null) => {
		// 过滤掉 ApplyView 和 PreviewView 的切换
		if ((leaf?.view instanceof ApplyView) || (leaf?.view instanceof PreviewView)) {
			return
		}

		const activeFile = app.workspace.getActiveFile()

		// 🎯 关键优化：只有当活动文件真正发生变化时才更新
		if (activeFile === currentActiveFileRef.current) {
			return // 文件没有变化，不需要更新
		}

		// 更新文件引用
		currentActiveFileRef.current = activeFile

		if (!activeFile) return

		const mentionable: Omit<MentionableCurrentFile, 'id'> = {
			type: 'current-file',
			file: activeFile,
		}

		if (!focusedMessageId) return
		if (inputMessage.id === focusedMessageId) {
			setInputMessage((prevInputMessage) => ({
				...prevInputMessage,
				mentionables: [
					mentionable,
					...prevInputMessage.mentionables.filter(
						(mentionable) => mentionable.type !== 'current-file',
					),
				],
			}))
		} else {
			setChatMessages((prevChatHistory) =>
				prevChatHistory.map((message) =>
					message.id === focusedMessageId && message.role === 'user'
						? {
							...message,
							mentionables: [
								mentionable,
								...message.mentionables.filter(
									(mentionable) => mentionable.type !== 'current-file',
								),
							],
						}
						: message,
				),
			)
		}
	}, [app.workspace, focusedMessageId, inputMessage.id])

	useEffect(() => {
		app.workspace.on('active-leaf-change', handleActiveLeafChange)
		return () => {
			app.workspace.off('active-leaf-change', handleActiveLeafChange)
		}
	}, [app.workspace, handleActiveLeafChange])

	useImperativeHandle(ref, () => ({
		openNewChat: (selectedBlock?: MentionableBlockData) =>
			handleNewChat(selectedBlock),
		addSelectionToChat: (selectedBlock: MentionableBlockData) => {
			const mentionable: Omit<MentionableBlock, 'id'> = {
				type: 'block',
				...selectedBlock,
			}

			setAddedBlockKey(getMentionableKey(serializeMentionable(mentionable)))

			if (focusedMessageId === inputMessage.id) {
				setInputMessage((prevInputMessage) => {
					const mentionableKey = getMentionableKey(
						serializeMentionable(mentionable),
					)
					// Check if mentionable already exists
					if (
						prevInputMessage.mentionables.some(
							(m) =>
								getMentionableKey(serializeMentionable(m)) === mentionableKey,
						)
					) {
						return prevInputMessage
					}
					return {
						...prevInputMessage,
						mentionables: [...prevInputMessage.mentionables, mentionable],
					}
				})
			} else {
				setChatMessages((prevChatHistory) =>
					prevChatHistory.map((message) => {
						if (message.id === focusedMessageId && message.role === 'user') {
							const mentionableKey = getMentionableKey(
								serializeMentionable(mentionable),
							)
							// Check if mentionable already exists
							if (
								message.mentionables.some(
									(m) =>
										getMentionableKey(serializeMentionable(m)) ===
										mentionableKey,
								)
							) {
								return message
							}
							return {
								...message,
								mentionables: [...message.mentionables, mentionable],
							}
						}
						return message
					}),
				)
			}
		},
		focusMessage: () => {
			if (!focusedMessageId) return
			chatUserInputRefs.current.get(focusedMessageId)?.focus()
		},
	}))

	return (
		<div className="infio-chat-container">
			{/* header view */}
			<div className="infio-chat-header">
				<div className="infio-chat-header-title">
					<WorkspaceSelect />
				</div>
				<div className="infio-chat-header-buttons">
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										setTab('chat')
										handleNewChat()
									}}
									className="infio-chat-list-dropdown"
								>
									<Plus size={18} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.newChat')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										if (tab === 'history') {
											setTab('chat')
										} else {
											setTab('history')
										}
									}}
									className="infio-chat-list-dropdown"
								>
									<History size={18} color={tab === 'history' ? 'var(--text-accent)' : 'var(--text-color)'} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.history')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										if (tab === 'search') {
											setTab('chat')
										} else {
											setTab('search')
										}
									}}
									className="infio-chat-list-dropdown"
								>
									<Search size={18} color={tab === 'search' ? 'var(--text-accent)' : 'var(--text-color)'} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.search')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										if (tab === 'insights') {
											setTab('chat')
										} else {
											setTab('insights')
										}
									}}
									className="infio-chat-list-dropdown"
								>
									<Lightbulb size={18} color={tab === 'insights' ? 'var(--text-accent)' : 'var(--text-color)'} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.insights')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										if (tab === 'workspace') {
											setTab('chat')
										} else {
											setTab('workspace')
										}
									}}
									className="infio-chat-list-dropdown"
								>
									<Box size={18} color={tab === 'workspace' ? 'var(--text-accent)' : 'var(--text-color)'} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.workspace')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										// switch between chat and prompts
										if (tab === 'commands') {
											setTab('chat')
										} else {
											setTab('commands')
										}
									}}
									className="infio-chat-list-dropdown"
								>
									<SquareSlash size={18} color={tab === 'commands' ? 'var(--text-accent)' : 'var(--text-color)'} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.commands')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										// switch between chat and prompts
										if (tab === 'custom-mode') {
											setTab('chat')
										} else {
											setTab('custom-mode')
										}
									}}
									className="infio-chat-list-dropdown"
								>
									<NotebookPen size={18} color={tab === 'custom-mode' ? 'var(--text-accent)' : 'var(--text-color)'} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.customMode')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
					<Tooltip.Provider delayDuration={0}>
						<Tooltip.Root>
							<Tooltip.Trigger asChild>
								<button
									onClick={() => {
										if (tab === 'mcp') {
											setTab('chat')
										} else {
											setTab('mcp')
										}
									}}
									className="infio-chat-list-dropdown"
								>
									<Server size={18} color={tab === 'mcp' ? 'var(--text-accent)' : 'var(--text-color)'} />
								</button>
							</Tooltip.Trigger>
							<Tooltip.Portal>
								<Tooltip.Content className="infio-tooltip-content">
									{t('chat.navigation.mcp')}
								</Tooltip.Content>
							</Tooltip.Portal>
						</Tooltip.Root>
					</Tooltip.Provider>
				</div>
			</div>
			{/* main view */}
			{tab === 'chat' ? (
				<>
					<div className="infio-chat-messages" ref={chatMessagesRef}>
						{
							// 如果正在初始化加载，显示加载状态
							isInitialLoading ? (
								<div className="infio-chat-empty-state">
									<div style={{ 
										display: 'flex', 
										flexDirection: 'column', 
										alignItems: 'center', 
										gap: '16px',
										color: 'var(--text-muted)'
									}}>
										<div className="infio-loading-spinner" style={{
											width: '24px',
											height: '24px',
											border: '2px solid var(--background-modifier-border)',
											borderTop: '2px solid var(--text-accent)',
											borderRadius: '50%',
											animation: 'spin 1s linear infinite'
										}} />
										<div>正在加载上次的聊天记录...</div>
									</div>
								</div>
							) : (
								// If the chat is empty, show a message to start a new chat
								chatMessages.length === 0 && (
									<div className="infio-chat-empty-state">
										<HelloInfo onNavigate={(tab) => setTab(tab)} />
									</div>
								)
							)
						}
						{chatMessages.map((message, index) =>
							message.role === 'user' ? (
								message.content &&
								<div key={"user-" + message.id} className="infio-chat-messages-user">
									{editingMessageId === message.id ? (
										<div className="infio-chat-edit-container">
											<button
												onClick={() => {
													setEditingMessageId(null)
													chatUserInputRefs.current.get(inputMessage.id)?.focus()
												}}
												className="infio-chat-edit-cancel-button"
												title="取消编辑"
											>
												<Undo size={16} />
											</button>
											<PromptInputWithActions
												key={"input-" + message.id}
												ref={(ref) => registerChatUserInputRef(message.id, ref)}
												initialSerializedEditorState={message.content}
												placeholder={t('chat.inputPlaceholder')}
												onSubmit={(content, useVaultSearch) => {
													if (editorStateToPlainText(content).trim() === '') return
													setEditingMessageId(null) // 退出编辑模式
													handleSubmit(
														[
															...chatMessages.slice(0, index),
															{
																role: 'user',
																applyStatus: ApplyStatus.Idle,
																content: content,
																promptContent: null,
																id: message.id,
																mentionables: message.mentionables,
															},
														],
														useVaultSearch,
													)
													chatUserInputRefs.current.get(inputMessage.id)?.focus()
												}}
												onFocus={() => {
													setFocusedMessageId(message.id)
												}}
												onCreateCommand={handleCreateCommand}
												mentionables={message.mentionables}
												setMentionables={(mentionables) => {
													setChatMessages((prevChatHistory) =>
														prevChatHistory.map((msg) =>
															msg.id === message.id ? { ...msg, mentionables } : msg,
														),
													)
												}}

											/>
										</div>
									) : (
										<ErrorBoundary>
											<UserMessageView
												content={message.content}
												mentionables={message.mentionables}
												onEdit={() => {
													setEditingMessageId(message.id)
													setFocusedMessageId(message.id)
													// 延迟聚焦，确保组件已渲染
													setTimeout(() => {
														chatUserInputRefs.current.get(message.id)?.focus()
													}, 0)
												}}
											/>
										</ErrorBoundary>
									)}
									{message.fileReadResults && (
										<FileReadResults
											key={"file-read-" + message.id}
											fileContents={message.fileReadResults}
										/>
									)}
									{message.websiteReadResults && (
										<WebsiteReadResults
											key={"website-read-" + message.id}
											websiteContents={message.websiteReadResults}
										/>
									)}
									{message.similaritySearchResults && (
										<SimilaritySearchResults
											key={"similarity-search-" + message.id}
											similaritySearchResults={message.similaritySearchResults}
										/>
									)}
								</div>
							) : (
								<div key={"assistant-" + message.id} className="infio-chat-messages-assistant">
									<MarkdownReasoningBlock
										key={"reasoning-" + message.id}
										reasoningContent={message.reasoningContent} />
									<ReactMarkdownItem
										key={"content-" + message.id}
										handleApply={(toolArgs) => handleApply(message.id, toolArgs)}
										applyStatus={message.applyStatus}
									>
										{message.content}
									</ReactMarkdownItem>
								</div>
							),
						)}
						<QueryProgress state={queryProgress} />
						{submitMutation.isPending && (
							<button onClick={abortActiveStreams} className="infio-stop-gen-btn">
								<CircleStop size={16} />
								<div>{t('chat.stop')}</div>
							</button>
						)}
					</div>
					{!isInitialLoading && (
						<PromptInputWithActions
							key={inputMessage.id}
							ref={(ref) => registerChatUserInputRef(inputMessage.id, ref)}
							initialSerializedEditorState={inputMessage.content}
							placeholder={t('chat.inputPlaceholder')}
							onSubmit={(content, useVaultSearch) => {
								if (editorStateToPlainText(content).trim() === '') return
								handleSubmit(
									[...chatMessages, { ...inputMessage, content }],
									useVaultSearch,
								)
								setInputMessage(getNewInputMessage(app, settings.defaultMention))
								preventAutoScrollRef.current = false
								handleScrollToBottom()
							}}
							onFocus={() => {
								setFocusedMessageId(inputMessage.id)
							}}
							onCreateCommand={handleCreateCommand}
							mentionables={inputMessage.mentionables}
							setMentionables={(mentionables) => {
								setInputMessage((prevInputMessage) => ({
									...prevInputMessage,
									mentionables,
								}))
							}}
							autoFocus={false}
							addedBlockKey={addedBlockKey}
						/>
					)}
				</>
			) : tab === 'search' ? (
				<div className="infio-chat-commands">
					<SearchView />
				</div>
			) : tab === 'commands' ? (
				<div className="infio-chat-commands">
					<CommandsView
						selectedSerializedNodes={selectedSerializedNodes}
					/>
				</div>
			) : tab === 'custom-mode' ? (
				<div className="infio-chat-commands">
					<CustomModeView />
				</div>
			) : tab === 'history' ? (
				<div className="infio-chat-commands">
					<ChatHistoryView
						currentConversationId={currentConversationId}
						onSelect={async (conversationId) => {
							setTab('chat')
							if (conversationId === currentConversationId) return
							await handleLoadConversation(conversationId)
						}}
						onDelete={async (conversationId) => {
							await deleteConversation(conversationId)
							if (conversationId === currentConversationId) {
								const nextConversation = chatList.find(
									(chat) => chat.id !== conversationId,
								)
								if (nextConversation) {
									void handleLoadConversation(nextConversation.id)
								} else {
									handleNewChat()
								}
							}
						}}
						onUpdateTitle={async (conversationId, newTitle) => {
							await updateConversationTitle(conversationId, newTitle)
						}}
					/>
				</div>
			) : tab === 'workspace' ? (
				<div className="infio-chat-commands">
					<WorkspaceView />
				</div>
			) : tab === 'insights' ? (
				<div className="infio-chat-commands">
					<InsightView />
				</div>
			) : (
				<div className="infio-chat-commands">
					<McpHubView />
				</div>
			)}
		</div>
	)
})

function ReactMarkdownItem({
	handleApply,
	applyStatus,
	// applyMutation,
	children,
}: {
	handleApply: (toolArgs: ToolArgs) => void
	applyStatus: ApplyStatus
	children: string
}) {
	return (
		<ReactMarkdown
			applyStatus={applyStatus}
			onApply={handleApply}
		>
			{children}
		</ReactMarkdown>
	)
}

Chat.displayName = 'Chat'

export default Chat
