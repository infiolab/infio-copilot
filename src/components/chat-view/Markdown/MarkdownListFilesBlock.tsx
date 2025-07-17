import { ChevronDown, ChevronRight, FolderOpen } from 'lucide-react'
import React, { useState } from 'react'

import { useApp } from "../../../contexts/AppContext"
import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ListFilesToolArgs } from "../../../types/apply"
import { openMarkdownFile } from "../../../utils/obsidian"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownListFilesBlock({
	applyStatus,
	onApply,
	path,
	recursive,
	finish,
	toolExecutionResult
}: {
	applyStatus: ApplyStatus
	onApply: (args: ListFilesToolArgs) => void
	path: string,
	recursive: boolean,
	finish: boolean
	toolExecutionResult?: {
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}
}) {
	const app = useApp()
	const { isDarkMode } = useDarkModeContext()
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	const handleClick = () => {
		openMarkdownFile(app, path)
	}

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'list_files',
				filepath: path,
				recursive
			})
		}
	}, [finish])

	return (
		<div>
			{/* 工具执行结果显示区域 */}
			<div
				className={`infio-chat-code-block infio-list-files-block ${path ? 'has-filename' : ''}`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<div className={'infio-chat-code-block-header'}>
					<div
						className={'infio-chat-code-block-header-filename'}
						onClick={(e) => {
							if (toolExecutionResult && isHovered) {
								e.stopPropagation()
								setIsResultOpen(!isResultOpen)
							} else {
								handleClick()
							}
						}}
						style={{ cursor: 'pointer' }}
					>
						{toolExecutionResult && isHovered ? (
							isResultOpen ? <ChevronDown size={14} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={14} className="infio-chat-code-block-header-icon" />
						) : (
							<FolderOpen size={14} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.listFiles').replace('{path}', path)}
					</div>
				</div>
				{/* 工具执行结果显示区域 */}
				{toolExecutionResult && isResultOpen && (
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={false}
						wrapLines={true}
					>
						{String(toolExecutionResult.content)}
					</MemoizedSyntaxHighlighterWrapper>
				)}
			</div>
		</div>
	)
} 
