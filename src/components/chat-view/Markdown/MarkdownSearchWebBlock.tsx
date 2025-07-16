import { Check, ChevronDown, ChevronRight, Loader2, Search, X } from 'lucide-react'
import React, { useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { useSettings } from "../../../contexts/SettingsContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, SearchWebToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownWebSearchBlock({
	applyStatus,
	onApply,
	query,
	finish,
	toolExecutionResult
}: {
	applyStatus: ApplyStatus
	onApply: (args: SearchWebToolArgs) => void
	query: string,
	finish: boolean
	toolExecutionResult?: {
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}
}) {
	const { settings } = useSettings()
	const { isDarkMode } = useDarkModeContext()
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	const handleClick = () => {
		if (settings.serperSearchEngine === 'google') {
			window.open(`https://www.google.com/search?q=${query}`, '_blank')
		} else if (settings.serperSearchEngine === 'bing') {
			window.open(`https://www.bing.com/search?q=${query}`, '_blank')
		} else {
			window.open(`https://duckduckgo.com/?q=${query}`, '_blank')
		}
	}

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'search_web',
				query: query,
			})
		}
	}, [finish])

	return (
		<div>
			<div
				className={`infio-chat-code-block infio-search-web-block has-filename`}
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
							<Search size={14} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.webSearch').replace('{query}', query)}
					</div>
				<div className={'infio-chat-code-block-header-button'}>
					<button
						style={{ color: '#008000' }}
						disabled={true}
					>
						{
							!finish || applyStatus === ApplyStatus.Idle ? (
								<>
									<Loader2 className="spinner" size={14} /> {t('chat.reactMarkdown.searching')}
								</>
							) : applyStatus === ApplyStatus.Applied ? (
								<>
									<Check size={14} /> {t('chat.reactMarkdown.done')}
								</>
							) : (
								<>
									<X size={14} /> {t('chat.reactMarkdown.failed')}
								</>
							)}
					</button>
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
