import { Check, ChevronDown, ChevronRight, Loader2, Replace, X } from 'lucide-react'
import React, { useState } from 'react'

import { useApp } from '../../../contexts/AppContext'
import { useDarkModeContext } from '../../../contexts/DarkModeContext'
import { t } from '../../../lang/helpers'
import { ApplyStatus, SearchAndReplaceToolArgs } from '../../../types/apply'
import { openMarkdownFile } from '../../../utils/obsidian'

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownSearchAndReplace({
	applyStatus,
	onApply,
	path,
	content,
	operations,
	finish,
	toolExecutionResult
}: {
	applyStatus: ApplyStatus
	onApply: (args: SearchAndReplaceToolArgs) => void
	path: string,
	content: string,
	operations: SearchAndReplaceToolArgs['operations'],
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

	const [applying, setApplying] = React.useState(false)
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	const handleClick = () => {
		openMarkdownFile(app, path)
	}

	const handleApply = async () => {
		if (applyStatus !== ApplyStatus.Idle) {
			return
		}
		setApplying(true)
		onApply({
			type: 'search_and_replace',
			filepath: path,
			operations
		})
	}

	return (
		<div>
			<div
				className={`infio-chat-code-block ${path ? 'has-filename' : ''}  infio-reasoning-block`}
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
							isResultOpen ? <ChevronDown size={10} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={10} className="infio-chat-code-block-header-icon" />
						) : (
							<Replace size={10} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.searchAndReplaceInPath').replace('{path}', path)}
					</div>
				<div className={'infio-chat-code-block-header-button'}>
					<button
						onClick={handleApply}
						disabled={applyStatus !== ApplyStatus.Idle || applying || !finish}
					>
						{!finish ? (
							<>
								<Loader2 className="spinner" size={14} />
							</>
						) : applyStatus === ApplyStatus.Idle ? (
							applying ? (
								<>
									<Loader2 className="spinner" size={14} /> {t('chat.reactMarkdown.applying')}
								</>
							) : (
								t('chat.reactMarkdown.apply')
							)
						) : applyStatus === ApplyStatus.Applied ? (
							<>
								<Check size={14} /> {t('chat.reactMarkdown.success')}
							</>
						) : (
							<>
								<X size={14} /> {t('chat.reactMarkdown.failed')}
							</>
						)}
					</button>
				</div>
			</div>
				<div className="infio-reasoning-content-wrapper">
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={!!path}
						wrapLines={true}
					>
						{content}
					</MemoizedSyntaxHighlighterWrapper>
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
