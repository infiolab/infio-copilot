import { $getRoot, LexicalEditor, SerializedEditorState } from 'lexical'
import {
	forwardRef,
	useImperativeHandle,
	useRef,
	useState
} from 'react'

import { Mentionable } from '../../../types/mentionable'

import LexicalContentEditable from './LexicalContentEditable'
import { SearchButton } from './SearchButton'

export type SearchInputRef = {
	focus: () => void
	clear: () => void
}

export type SearchInputProps = {
	initialSerializedEditorState: SerializedEditorState | null
	onChange?: (content: SerializedEditorState) => void
	onSubmit: (content: SerializedEditorState, useVaultSearch?: boolean) => void
	mentionables?: Mentionable[]
	setMentionables?: (mentionables: Mentionable[]) => void
	placeholder?: string
	autoFocus?: boolean
	disabled?: boolean
}

// 检查编辑器状态是否为空的辅助函数
const isEditorStateEmpty = (editorState: SerializedEditorState): boolean => {
	if (!editorState || !editorState.root || !editorState.root.children) {
		return true
	}
	
	const children = editorState.root.children
	if (children.length === 0) {
		return true
	}
	
	// 检查是否只有空的段落
	if (children.length === 1 && children[0].type === 'paragraph') {
		const paragraph = children[0] as any
		return !paragraph.children || paragraph.children.length === 0
	}
	
	return false
}

const SearchInputWithActions = forwardRef<SearchInputRef, SearchInputProps>(
	(
		{
			initialSerializedEditorState,
			onChange,
			onSubmit,
			placeholder = '',
			autoFocus = false,
			disabled = false,
		},
		ref
	) => {
		const editorRef = useRef<LexicalEditor | null>(null)
		const contentEditableRef = useRef<HTMLDivElement>(null)
		const containerRef = useRef<HTMLDivElement>(null)
		
		// 追踪编辑器是否为空
		const [isEmpty, setIsEmpty] = useState(() => 
			initialSerializedEditorState ? isEditorStateEmpty(initialSerializedEditorState) : true
		)

		// 暴露给父组件的方法
		useImperativeHandle(ref, () => ({
			focus: () => {
				contentEditableRef.current?.focus()
			},
			clear: () => {
				editorRef.current?.update(() => {
					const root = $getRoot()
					root.clear()
				})
				setIsEmpty(true)
			}
		}))

		const handleSubmit = (options?: { useVaultSearch?: boolean }) => {
			const content = editorRef.current?.getEditorState()?.toJSON()
			if (content) {
				onSubmit(content, options?.useVaultSearch)
			}
		}

		const handleChange = (content: SerializedEditorState) => {
			// 检查内容是否为空并更新状态
			setIsEmpty(isEditorStateEmpty(content))
			// 调用父组件的 onChange 回调
			onChange?.(content)
		}

		const onCreateCommand = () => {
			// 处理命令创建逻辑
			// 这里可以根据实际需求添加具体实现
		}

		return (
			<div 
				className={`infio-chat-user-input-container ${disabled ? 'disabled' : ''}`} 
				ref={containerRef}
			>
				{placeholder && isEmpty && (
					<div className="infio-input-placeholder">
						{placeholder}
					</div>
				)}
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
					onEnter={() => handleSubmit()}
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
						{/* TODO: add model select */}
					</div>
					<div className="infio-chat-user-input-controls__buttons">
						<SearchButton onClick={() => handleSubmit()} />
					</div>
				</div>
				<style>
					{`
					.infio-chat-user-input-container.disabled {
						opacity: 0.6;
						pointer-events: none;
					}

					.infio-input-placeholder {
						position: absolute;
						color: var(--text-muted);
						pointer-events: none;
						z-index: 1;
						padding: calc(var(--size-2-2) + 1px) var(--size-4-2);
						font-size: var(--font-ui-small);
					}

					.infio-search-button {
						position: absolute;
						bottom: var(--size-2-2);
						right: var(--size-2-2);
						display: flex;
						align-items: center;
						justify-content: center;
						width: var(--size-4-4);
						height: var(--size-4-4);
						padding: 0;
						background-color: transparent;
						border: none;
						box-shadow: none;
						color: var(--text-muted);
						cursor: pointer;
						border-radius: var(--radius-s);
						transition: all 0.15s ease-in-out;
						z-index: 10;
					}
					`}
				</style>
			</div>
		)
	},
)

SearchInputWithActions.displayName = 'SearchInput'

export default SearchInputWithActions
