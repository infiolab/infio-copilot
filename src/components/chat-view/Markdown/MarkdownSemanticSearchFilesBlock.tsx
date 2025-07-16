import { ChevronDown, ChevronRight, FileSearch } from 'lucide-react'
import React, { useState } from 'react'

import { useApp } from "../../../contexts/AppContext"
import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, SemanticSearchFilesToolArgs } from "../../../types/apply"
import { openMarkdownFile } from "../../../utils/obsidian"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownSemanticSearchFilesBlock({
	applyStatus,
	onApply,
	path,
	query,
	finish,
	toolExecutionResult
}: {
	applyStatus: ApplyStatus
	onApply: (args: SemanticSearchFilesToolArgs) => void
	path: string,
	query: string,
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
				type: 'semantic_search_files',
				filepath: path,
				query: query,
			})
		}
	}, [finish])

	return (
		<div>
			<div
				className={`infio-chat-code-block infio-semantic-search-files-block ${path ? 'has-filename' : ''}`}
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
					>
						{toolExecutionResult && isHovered ? (
							isResultOpen ? <ChevronDown size={14} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={14} className="infio-chat-code-block-header-icon" />
						) : (
							<FileSearch size={14} className="infio-chat-code-block-header-icon" />
						)}
						<span>{t('chat.reactMarkdown.semanticSearchInPath').replace('{query}', query).replace('{path}', path)}</span>
					</div>
				</div>
			</div>
			{/* 工具执行结果显示区域 */}
			{toolExecutionResult && isResultOpen && (
				<div className="infio-reasoning-content-wrapper">
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={false}
						wrapLines={true}
					>
						{toolExecutionResult.content}
					</MemoizedSyntaxHighlighterWrapper>
				</div>
			)}
		</div>
	)
} 
