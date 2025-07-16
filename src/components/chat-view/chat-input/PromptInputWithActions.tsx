import { BaseSerializedNode } from '@lexical/clipboard/clipboard'
import { useQuery } from '@tanstack/react-query'
import { $getRoot, $nodesOfType, $setSelection, $createRangeSelection, LexicalEditor, SerializedEditorState } from 'lexical'
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState,
} from 'react'

import { useApp } from '../../../contexts/AppContext'
import { useDarkModeContext } from '../../../contexts/DarkModeContext'
import { useSettings } from '../../../contexts/SettingsContext'
import useChatInputStore from '../../../stores/chat-input-store'
import {
	Mentionable,
	MentionableImage,
	SerializedMentionable,
} from '../../../types/mentionable'
import { fileToMentionableImage } from '../../../utils/image'
import {
	deserializeMentionable,
	getMentionableKey,
	serializeMentionable,
} from '../../../utils/mentionable'
import { openMarkdownFile, readTFileContent } from '../../../utils/obsidian'
import { MemoizedSyntaxHighlighterWrapper } from '../Markdown/SyntaxHighlighterWrapper'

import { ImageUploadButton } from './ImageUploadButton'
import LexicalContentEditable from './LexicalContentEditable'
import MentionableBadge from './MentionableBadge'
import { ModelSelect } from './ModelSelect'
import { ModeSelect } from './ModeSelect'
import { MentionNode } from './plugins/mention/MentionNode'
import { NodeMutations } from './plugins/on-mutation/OnMutationPlugin'
import { SubmitButton } from './SubmitButton'
export type ChatUserInputRef = {
	focus: () => void
}

// 检查编辑器状态是否为空
const isEditorStateEmpty = (editorState: SerializedEditorState): boolean => {
	try {
		const root = editorState.root
		if (!root || !root.children) return true
		
		// 检查是否有实际内容
		const hasContent = root.children.some((child: { type: string; children?: any[] }) => {
			if (child.type === 'paragraph') {
				return child.children && child.children.length > 0
			}
			return true
		})
		
		return !hasContent
	} catch (error) {
		return true
	}
}

export type ChatUserInputProps = {
	initialSerializedEditorState: SerializedEditorState | null
	onChange?: (content: SerializedEditorState) => void
	onSubmit: (content: SerializedEditorState, useVaultSearch?: boolean) => void
	onFocus: () => void
	onCreateCommand: (nodes: BaseSerializedNode[]) => void
	mentionables: Mentionable[]
	setMentionables: (mentionables: Mentionable[]) => void
	autoFocus?: boolean
	addedBlockKey?: string | null
	placeholder?: string
}

const PromptInputWithActions = forwardRef<ChatUserInputRef, ChatUserInputProps>(
	(
		{
			initialSerializedEditorState,
			onChange,
			onSubmit,
			onFocus,
			onCreateCommand,
			mentionables,
			setMentionables,
			autoFocus = false,
			addedBlockKey,
			placeholder = '',
		},
		ref,
	) => {
		const app = useApp()
		const { settings, setSettings } = useSettings()
		const {
			addToHistory,
			getPreviousHistory,
			getNextHistory,
			resetHistoryIndex,
			setCurrentInput,
			currentHistoryIndex,
		} = useChatInputStore()

		const editorRef = useRef<LexicalEditor | null>(null)
		const contentEditableRef = useRef<HTMLDivElement>(null)
		const containerRef = useRef<HTMLDivElement>(null)

		const [displayedMentionableKey, setDisplayedMentionableKey] = useState<
			string | null
		>(addedBlockKey ?? null)

		// 追踪编辑器是否为空
		const [isEmpty, setIsEmpty] = useState(() => 
			initialSerializedEditorState ? isEditorStateEmpty(initialSerializedEditorState) : true
		)

		useEffect(() => {
			if (addedBlockKey) {
				setDisplayedMentionableKey(addedBlockKey)
			}
		}, [addedBlockKey])

		// 添加快捷键监听器
		useEffect(() => {
			const handleKeyDown = (event: KeyboardEvent) => {
				// 检查是否在输入框中
				const isInInputArea = contentEditableRef.current?.contains(event.target as Node)
				
				if (isInInputArea && !event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
					// 处理历史记录导航
					if (event.key === 'ArrowUp') {
						event.preventDefault()
						// 只有在第一次按up键时才保存当前输入（currentHistoryIndex === -1）
						if (currentHistoryIndex === -1) {
							const currentEditorState = editorRef.current?.getEditorState()?.toJSON()
							setCurrentInput(currentEditorState || null)
						}
						const previousHistory = getPreviousHistory()
						if (previousHistory && editorRef.current) {
							editorRef.current.setEditorState(
								editorRef.current.parseEditorState(previousHistory)
							)
							// 重新聚焦并将光标定位到文档末尾
							editorRef.current.focus()
							editorRef.current.update(() => {
								const root = $getRoot()
								root.selectEnd()
							})
						}
						return
					}
					
					if (event.key === 'ArrowDown') {
						event.preventDefault()
						const nextHistory = getNextHistory()
						if (nextHistory && editorRef.current) {
							editorRef.current.setEditorState(
								editorRef.current.parseEditorState(nextHistory)
							)
							// 重新聚焦并将光标定位到文档末尾
							editorRef.current.focus()
							editorRef.current.update(() => {
								const root = $getRoot()
								root.selectEnd()
							})
						} else if (nextHistory === null && editorRef.current) {
							// 如果nextHistory为null，表示需要清空编辑器
							editorRef.current.update(() => {
								const root = $getRoot()
								root.clear()
							})
							// 重新聚焦
							editorRef.current.focus()
						}
						return
					}
				}
				
				// 检查是否按下了 Cmd + Shift 键 (macOS)
				if (event.ctrlKey && event.shiftKey) {
					// 使用 event.key 直接匹配，不使用 toLowerCase()
					switch (event.key) {
						case '.':
						case '>': // Shift + . 在某些键盘布局下可能是 >
							event.preventDefault()
							setSettings({
								...settings,
								mode: 'write',
							})
							break
						case ',':
						case '<': // Shift + , 在某些键盘布局下可能是 <
							event.preventDefault()
							setSettings({
								...settings,
								mode: 'ask',
							})
							break
						case '/':
						case '?': // Shift + / 在某些键盘布局下可能是 ?
							event.preventDefault()
							setSettings({
								...settings,
								mode: 'research',
							})
							break
					}
				}
			}

			// 添加事件监听器到 document
			document.addEventListener('keydown', handleKeyDown)

			// 清理函数
			return () => {
				document.removeEventListener('keydown', handleKeyDown)
			}
		}, [settings, setSettings, getPreviousHistory, getNextHistory, setCurrentInput, currentHistoryIndex])

		useImperativeHandle(ref, () => ({
			focus: () => {
				contentEditableRef.current?.focus()
			},
		}))

		const handleMentionNodeMutation = (
			mutations: NodeMutations<MentionNode>,
		) => {
			const destroyedMentionableKeys: string[] = []
			const addedMentionables: SerializedMentionable[] = []
			mutations.forEach((mutation) => {
				const mentionable = mutation.node.getMentionable()
				const mentionableKey = getMentionableKey(mentionable)

				if (mutation.mutation === 'destroyed') {
					const nodeWithSameMentionable = editorRef.current?.read(() =>
						$nodesOfType(MentionNode).find(
							(node) =>
								getMentionableKey(node.getMentionable()) === mentionableKey,
						),
					)

					if (!nodeWithSameMentionable) {
						// remove mentionable only if it's not present in the editor state
						destroyedMentionableKeys.push(mentionableKey)
					}
				} else if (mutation.mutation === 'created') {
					if (
						mentionables.some(
							(m) =>
								getMentionableKey(serializeMentionable(m)) === mentionableKey,
						) ||
						addedMentionables.some(
							(m) => getMentionableKey(m) === mentionableKey,
						)
					) {
						// do nothing if mentionable is already added
						return
					}

					addedMentionables.push(mentionable)
				}
			})

			setMentionables(
				mentionables
					.filter(
						(m) =>
							!destroyedMentionableKeys.includes(
								getMentionableKey(serializeMentionable(m)),
							),
					)
					.concat(
						addedMentionables
							.map((m) => deserializeMentionable(m, app))
							.filter((v) => !!v),
					),
			)
			if (addedMentionables.length > 0) {
				setDisplayedMentionableKey(
					getMentionableKey(addedMentionables[addedMentionables.length - 1]),
				)
			}
		}

		const handleCreateImageMentionables = useCallback(
			(mentionableImages: MentionableImage[]) => {
				const newMentionableImages = mentionableImages.filter(
					(m) =>
						!mentionables.some(
							(mentionable) =>
								getMentionableKey(serializeMentionable(mentionable)) ===
								getMentionableKey(serializeMentionable(m)),
						),
				)
				if (newMentionableImages.length === 0) return
				setMentionables([...mentionables, ...newMentionableImages])
				setDisplayedMentionableKey(
					getMentionableKey(
						serializeMentionable(
							newMentionableImages[newMentionableImages.length - 1],
						),
					),
				)
			},
			[mentionables, setMentionables],
		)

		const handleMentionableDelete = (mentionable: Mentionable) => {
			const mentionableKey = getMentionableKey(
				serializeMentionable(mentionable),
			)
			setMentionables(
				mentionables.filter(
					(m) => getMentionableKey(serializeMentionable(m)) !== mentionableKey,
				),
			)

			editorRef.current?.update(() => {
				$nodesOfType(MentionNode).forEach((node) => {
					if (getMentionableKey(node.getMentionable()) === mentionableKey) {
						node.remove()
					}
				})
			})
		}

		const handleUploadImages = async (images: File[]) => {
			const mentionableImages = await Promise.all(
				images.map((image) => fileToMentionableImage(image)),
			)
			handleCreateImageMentionables(mentionableImages)
		}

		const handleSubmit = (options: { useVaultSearch?: boolean } = {}) => {
			const content = editorRef.current?.getEditorState()?.toJSON()
			if (content) {
				// 保存到历史记录
				addToHistory(content)
				// 重置历史索引
				resetHistoryIndex()
				// 提交内容
				onSubmit(content, options.useVaultSearch)
			}
		}

		const handleChange = (content: SerializedEditorState) => {
			// 检查内容是否为空并更新状态
			setIsEmpty(isEditorStateEmpty(content))
			// 调用父组件的 onChange 回调
			onChange?.(content)
		}

		return (
			<div className="infio-chat-user-input-container" ref={containerRef}>
				{placeholder && isEmpty && (
					<div className="infio-input-placeholder">
						{placeholder}
					</div>
				)}
				{mentionables.length > 0 && (
					<div className="infio-chat-user-input-files">
						{mentionables.map((m) => (
							<MentionableBadge
								key={getMentionableKey(serializeMentionable(m))}
								mentionable={m}
								onDelete={() => handleMentionableDelete(m)}
								onClick={() => {
									const mentionableKey = getMentionableKey(
										serializeMentionable(m),
									)
									if (
										(m.type === 'current-file' ||
											m.type === 'file' ||
											m.type === 'block') &&
										m.file &&
										mentionableKey === displayedMentionableKey
									) {
										// open file on click again
										openMarkdownFile(
											app,
											m.file.path,
											m.type === 'block' ? m.startLine : undefined,
										)
									} else {
										setDisplayedMentionableKey(mentionableKey)
									}
								}}
								isFocused={
									getMentionableKey(serializeMentionable(m)) ===
									displayedMentionableKey
								}
							/>
						))}
					</div>
				)}

				<MentionableContentPreview
					displayedMentionableKey={displayedMentionableKey}
					mentionables={mentionables}
				/>

				<LexicalContentEditable
					initialEditorState={(editor) => {
						if (initialSerializedEditorState) {
							editor.setEditorState(
								editor.parseEditorState(initialSerializedEditorState),
							)
						}
					}}
					editorRef={editorRef}
					contentEditableRef={contentEditableRef}
					onChange={handleChange}
					onEnter={() => handleSubmit({ useVaultSearch: false })}
					onFocus={onFocus}
					onMentionNodeMutation={handleMentionNodeMutation}
					onCreateImageMentionables={handleCreateImageMentionables}
					autoFocus={autoFocus}
					plugins={{
						onEnter: {
							onVaultChat: () => {
								handleSubmit({ useVaultSearch: true })
							},
						},
						commandPopover: {
							anchorElement: containerRef.current,
							onCreateCommand: onCreateCommand,
						},
					}}
				/>

				<div className="infio-chat-user-input-controls">
					<div className="infio-chat-user-input-controls__model-select-container">
						<ModeSelect />
						<ModelSelect />
					</div>
					<div className="infio-chat-user-input-controls__buttons">
						<ImageUploadButton onUpload={handleUploadImages} />
						<SubmitButton onClick={() => handleSubmit()} />
					</div>
				</div>
				<style>
					{`
					.infio-input-placeholder {
						position: absolute;
						color: var(--text-muted);
						pointer-events: none;
						z-index: 1;
						padding: calc(var(--size-2-2) + 1px) var(--size-4-2);
						font-size: var(--font-ui-small);
					}
					`}
				</style>
			</div>
		)
	},
)

function MentionableContentPreview({
	displayedMentionableKey,
	mentionables,
}: {
	displayedMentionableKey: string | null
	mentionables: Mentionable[]
}) {
	const app = useApp()
	const { isDarkMode } = useDarkModeContext()

	const displayedMentionable: Mentionable | null = useMemo(() => {
		return (
			mentionables.find(
				(m) =>
					getMentionableKey(serializeMentionable(m)) ===
					displayedMentionableKey,
			) ?? null
		)
	}, [displayedMentionableKey, mentionables])

	const { data: displayFileContent } = useQuery({
		enabled:
			!!displayedMentionable &&
			['file', 'current-file', 'block'].includes(displayedMentionable.type),
		queryKey: [
			'file',
			displayedMentionableKey,
			mentionables.map((m) => getMentionableKey(serializeMentionable(m))), // should be updated when mentionables change (especially on delete)
		],
		queryFn: async () => {
			if (!displayedMentionable) return null
			if (
				displayedMentionable.type === 'file' ||
				displayedMentionable.type === 'current-file'
			) {
				if (!displayedMentionable.file) return null
				return await readTFileContent(displayedMentionable.file, app.vault)
			} else if (displayedMentionable.type === 'block') {
				const fileContent = await readTFileContent(
					displayedMentionable.file,
					app.vault,
				)

				return fileContent
					.split('\n')
					.slice(
						displayedMentionable.startLine - 1,
						displayedMentionable.endLine,
					)
					.join('\n')
			}

			return null
		},
	})

	const displayImage: MentionableImage | null = useMemo(() => {
		return displayedMentionable?.type === 'image' ? displayedMentionable : null
	}, [displayedMentionable])

	return displayFileContent ? (
		<div className="infio-chat-user-input-file-content-preview">
			<MemoizedSyntaxHighlighterWrapper
				isDarkMode={isDarkMode}
				language="markdown"
				hasFilename={false}
				wrapLines={false}
			>
				{displayFileContent}
			</MemoizedSyntaxHighlighterWrapper>
		</div>
	) : displayImage ? (
		<div className="infio-chat-user-input-file-content-preview">
			<img src={displayImage.data} alt={displayImage.name} />
		</div>
	) : null
}

PromptInputWithActions.displayName = 'ChatUserInput'

export default PromptInputWithActions
