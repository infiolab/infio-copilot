import { SerializedEditorState } from 'lexical'
import { Pencil } from 'lucide-react'
import React, { useState } from 'react'

import { Mentionable } from '../../types/mentionable'

import { editorStateToPlainText } from './chat-input/utils/editor-state-to-plain-text'
import { getMentionableIcon } from './chat-input/utils/get-metionable-icon'

interface UserMessageViewProps {
	content: SerializedEditorState | null
	mentionables: Mentionable[]
	onEdit: () => void
}

const UserMessageView: React.FC<UserMessageViewProps> = ({
	content,
	mentionables,
	onEdit,
}) => {
	const [isExpanded, setIsExpanded] = useState(false)

	// 将编辑器状态转换为纯文本
	const plainText = content ? editorStateToPlainText(content) : ''

	// 判断是否需要截断（超过2行或超过80个字符）
	const lines = plainText.split('\n')
	const needsTruncation = lines.length > 3 || plainText.length > 80

	// 显示的文本内容
	let displayText = plainText
	if (needsTruncation && !isExpanded) {
		// 取前2行或前80个字符，取较小值
		const truncatedByLines = lines.slice(0, 2).join('\n')
		displayText = truncatedByLines.length > 80
			? plainText.substring(0, 80) + '...'
			: truncatedByLines + (lines.length > 2 ? '...' : '')
	}

	return (
		<div className="infio-user-message-view">
			<div className="infio-user-message-content">
				{/* 显示 mentionables */}
				{mentionables.length > 0 && (
					<div className="infio-user-message-mentions">
						{mentionables.map((mentionable, index) => {
							const Icon = getMentionableIcon(mentionable)
							return (
								<span key={index} className="infio-mention-tag">
									{Icon && <Icon size={12} />}
									{mentionable.type === 'current-file' && (
										<span>{mentionable.file.name}</span>
									)}
									{mentionable.type === 'vault' && (
										<span>Vault</span>
									)}
									{mentionable.type === 'block' && (
										<span>{mentionable.file.name}</span>
									)}
									{mentionable.type === 'file' && (
										<span>{mentionable.file.name}</span>
									)}
									{mentionable.type === 'folder' && (
										<span>{mentionable.folder.name}</span>
									)}
									{mentionable.type === 'url' && (
										<span>{mentionable.url}</span>
									)}
									{mentionable.type === 'image' && (
										<span>{mentionable.name}</span>
									)}
								</span>
							)
						})}
					</div>
				)}

				{/* 显示文本内容 */}
				<div className="infio-user-message-text">
					<pre>{displayText}</pre>
					{/* {needsTruncation && (
						<button
							className="infio-user-message-expand-btn"
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<>
									<ChevronUp size={14} />
								</>
							) : (
								<>
									<ChevronDown size={14} />
								</>
							)}
						</button>
					)} */}
				</div>
			</div>

			{/* 编辑按钮 */}
			<button
				className="infio-user-message-edit-btn"
				onClick={onEdit}
				title="编辑消息"
			>
				<Pencil size={14} />
			</button>

			<style>
				{`
					/*
					* User Message View
					* - Readonly view for user messages with edit functionality
					*/
					.infio-user-message-view {
						position: relative;
						display: flex;
						align-items: flex-start;
						background: var(--background-secondary-alt);
						border: 2px solid var(--background-modifier-border);
						border-radius: var(--radius-s);
						padding: calc(var(--size-2-2) + 1px);
						min-height: 62px;
						gap: var(--size-2-2);
						box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
						transition: all 0.15s ease-in-out;
					}

					.infio-user-message-view:hover {
						box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
					}

					.infio-user-message-avatar {
						flex-shrink: 0;
						display: flex;
						align-items: center;
						justify-content: center;
						width: 28px;
						height: 28px;
						background: var(--interactive-accent);
						border-radius: 50%;
						color: var(--text-on-accent);
						margin-top: 2px;
					}

					.infio-user-message-content {
						flex: 1;
						display: flex;
						flex-direction: column;
						gap: var(--size-2-1);
						min-width: 0; /* 防止内容溢出 */
					}

					.infio-user-message-mentions {
						display: flex;
						flex-wrap: wrap;
						gap: var(--size-2-1);
					}

					.infio-mention-tag {
						display: inline-flex;
						align-items: center;
						background-color: var(--background-secondary-alt);
						border: 1px solid var(--interactive-accent);
						border-radius: var(--radius-s);
						font-size: var(--font-smallest);
						padding: var(--size-2-1) var(--size-4-1);
						gap: var(--size-2-1);
						color: var(--interactive-accent);
						white-space: nowrap;
						font-weight: 500;
					}

					.infio-user-message-text {
						color: var(--text-normal);
						font-size: var(--font-ui-medium);
						line-height: var(--line-height-normal);
					}

					.infio-user-message-text pre {
						margin: 0;
						font-family: inherit;
						white-space: pre-wrap;
						word-wrap: break-word;
						overflow-wrap: break-word;
					}

					.infio-user-message-view:hover {
						opacity: 1;
					}

					.infio-user-message-edit-btn {
						display: flex;
						align-items: center;
						justify-content: center;
						background-color: transparent !important;
						border: none !important;
						box-shadow: none !important;
						color: var(--text-muted);
						padding: 0 !important;
						margin: 0 !important;
						width: 24px !important;
						height: 24px !important;

						&:hover {
							background-color: var(--background-modifier-hover) !important;
						}
					}

					.infio-user-message-expand-btn {
						display: flex;
						align-items: center;
						justify-content: center;
						background-color: transparent !important;
						border: none !important;
						box-shadow: none !important;
						color: var(--text-muted);
						padding: 0 !important;
						margin: 0 !important;
						width: 24px !important;
						height: 24px !important;

						&:hover {
							background-color: var(--background-modifier-hover) !important;
						}
					}

				`}
			</style>
		</div>
	)
}

export default UserMessageView 
