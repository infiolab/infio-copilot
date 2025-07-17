import { BaseSerializedNode } from '@lexical/clipboard/clipboard'
import * as Tooltip from '@radix-ui/react-tooltip'
import { useMutation } from '@tanstack/react-query'
import { Box, CircleStop, History, Lightbulb, NotebookPen, Plus, Search, Server, SquareSlash, Undo } from 'lucide-react'
import { App, Notice, TFile, WorkspaceLeaf } from 'obsidian'
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

import { ApplyView } from '../../ApplyView'
import { useApp } from '../../contexts/AppContext'
import { useDataview } from '../../contexts/DataviewContext'
import { useDiffStrategy } from '../../contexts/DiffStrategyContext'
import { useLLM } from '../../contexts/LLMContext'
import { useMcpHub } from '../../contexts/McpHubContext'
import { useRAG } from '../../contexts/RAGContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useTrans } from '../../contexts/TransContext'
import {
	LLMAPIKeyInvalidException,
	LLMAPIKeyNotSetException,
	LLMBaseUrlNotSetException,
	LLMModelNotSetException,
} from '../../core/llm/exception'
import { ToolManager, ToolManagerDependencies } from '../../core/tools/tool-manager'
import { WorkspaceManager } from '../../database/json/workspace/WorkspaceManager'
import { useChatHistory } from '../../hooks/use-chat-history'
import { useCustomModes } from '../../hooks/use-custom-mode'
import { t } from '../../lang/helpers'
import { PreviewView } from '../../PreviewView'
import useChatStore from '../../stores/chat-store'
import { ApplyStatus, ToolArgs, ToolExecutionResult } from '../../types/apply'
import { ChatMessage, ChatUserMessage } from '../../types/chat'
import {
	Mentionable,
	MentionableBlock,
	MentionableBlockData,
	MentionableCurrentFile,
} from '../../types/mentionable'
import {
	getMentionableKey,
	serializeMentionable,
} from '../../utils/mentionable'
import { openSettingsModalWithError } from '../../utils/open-settings-modal'
import { PromptGenerator } from '../../utils/prompt-generator'
// Removed empty line above, added one below for group separation
import { onEnt } from '../../utils/web-search'
import ErrorBoundary from '../common/ErrorBoundary'

import PromptInputWithActions, { ChatUserInputRef } from './chat-input/PromptInputWithActions'
import { editorStateToPlainText } from './chat-input/utils/editor-state-to-plain-text'
import ChatHistoryView from './ChatHistoryView'
import CommandsView from './CommandsView'
import CustomModeView from './CustomModeView'
import FileReadResults from './FileReadResults'
import HelloInfo from './HelloInfo'
import InsightView from './InsightView'
import MarkdownOptimizedReasoningBlock from './Markdown/MarkdownOptimizedReasoningBlock'
import MarkdownToolResult from './Markdown/MarkdownToolResult'
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

	const toolManager = useMemo(() => {
		const dependencies: ToolManagerDependencies = {
			app,
			settings,
			workspaceManager,
			diffStrategy,
			getRAGEngine,
			getTransEngine,
			getMcpHub,
			getDataviewManager: () => dataviewManager,
		}
		return new ToolManager(dependencies)
	}, [app, settings, workspaceManager, diffStrategy, getRAGEngine, getTransEngine, getMcpHub, dataviewManager])

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

	const applyMutation = useMutation<ToolExecutionResult, Error, { applyMsgId: string, toolArgs: ToolArgs }>({
		mutationFn: async ({ applyMsgId, toolArgs }: { applyMsgId: string, toolArgs: ToolArgs }): Promise<ToolExecutionResult> => {
			// 处理 switch_mode 工具的特殊情况，因为它需要访问 setSettings
			if (toolArgs.type === 'switch_mode') {
				setSettings({
					...settings,
					mode: toolArgs.mode,
				})
				const formattedContent = `[switch_mode to ${toolArgs.mode}] Result: successfully switched to ${toolArgs.mode}\n`
				return {
					type: 'switch_mode',
					applyMsgId,
					applyStatus: ApplyStatus.Applied,
					toolResultContent: formattedContent,
					returnMsg: {
						role: 'user' as const,
						applyStatus: ApplyStatus.Idle,
						content: null,
						promptContent: formattedContent,
						id: uuidv4(),
						mentionables: [],
					}
				}
			}
			
			// 使用工具管理器处理其他所有工具
			return await toolManager.executeTool(toolArgs, applyMsgId)
		},
		onSuccess: (result: ToolExecutionResult) => {
			if (result.applyMsgId) {
				let newChatMessages: ChatMessage[] = [...chatMessages];

				// 更新原始 assistant 消息的状态和工具执行结果
				newChatMessages = newChatMessages.map((message) => {
					if (message.role === 'assistant' && message.id === result.applyMsgId) {
						const toolExecutionResult = {
							type: result.type,
							status: result.applyStatus,
							content: result.toolResultContent || result.error || '',
							timestamp: Date.now(),
						};

						return {
							...message,
							applyStatus: result.applyStatus,
							toolExecutionResults: [
								...(message.toolExecutionResults || []),
								toolExecutionResult,
							],
						};
					}
					return message;
				});

				setChatMessages(newChatMessages);

				// 如果有 returnMsg，继续提交新的用户消息
				if (result.returnMsg) {
					const userMessage: ChatUserMessage = {
						...result.returnMsg,
						role: 'user' as const,
					};
					handleSubmit([...newChatMessages, userMessage], false);
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

	const handleAccept = useCallback(
		(applyMsgId: string) => {
			// Update message status to applied
			setChatMessages(prev => 
				prev.map(msg => 
					msg.id === applyMsgId 
						? { ...msg, applyStatus: ApplyStatus.Applied }
						: msg
				)
			)
		},
		[],
	)

	const handleReject = useCallback(
		(applyMsgId: string) => {
			// Update message status to rejected
			setChatMessages(prev => 
				prev.map(msg => 
					msg.id === applyMsgId 
						? { ...msg, applyStatus: ApplyStatus.Rejected }
						: msg
				)
			)
		},
		[],
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
									<div className="infio-chat-loading-container">
										<div className="infio-loading-spinner" />
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
									<MarkdownOptimizedReasoningBlock
										key={"reasoning-" + message.id}
										reasoningContent={message.reasoningContent}
										isFinished={!submitMutation.isPending || index !== chatMessages.length - 1}
										blockType="thinking"
									/>
									{message.isToolResult && message.toolResultContent ? (
										<MarkdownToolResult
											key={"tool-result-" + message.id}
											content={message.toolResultContent}
										/>
									) : (
										<ReactMarkdownItem
											key={"content-" + message.id}
											handleApply={(toolArgs) => handleApply(message.id, toolArgs)}
											handleAccept={() => handleAccept(message.id)}
											handleReject={() => handleReject(message.id)}
											applyStatus={message.applyStatus}
											toolExecutionResults={message.toolExecutionResults}
										>
											{message.content}
										</ReactMarkdownItem>
									)}
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
	handleAccept,
	handleReject,
	applyStatus,
	toolExecutionResults,
	children,
}: {
	handleApply: (toolArgs: ToolArgs) => void
	handleAccept?: () => void
	handleReject?: () => void
	applyStatus: ApplyStatus
	toolExecutionResults?: Array<{
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}>
	children: string
}) {
	return (
		<ReactMarkdown
			applyStatus={applyStatus}
			onApply={handleApply}
			onAccept={handleAccept}
			onReject={handleReject}
			toolExecutionResults={toolExecutionResults}
		>
			{children}
		</ReactMarkdown>
	)
}

Chat.displayName = 'Chat'

export default Chat
