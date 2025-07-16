import { Check, ChevronDown, ChevronRight, Loader2, Settings2, X } from 'lucide-react'
import { PropsWithChildren, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ToolArgs } from "../../../types/apply"

import MarkdownToolResult from "./MarkdownToolResult"
import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownSwitchModeBlock({
	mode,
	applyStatus,
	onApply,
	reason,
	finish,
	toolExecutionResult,
}: PropsWithChildren<{
	mode: string
	applyStatus: ApplyStatus
	onApply: (args: ToolArgs) => void
	reason: string
	finish: boolean
	toolExecutionResult?: {
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}
}>) {
	const [applying, setApplying] = useState(false)
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const { isDarkMode } = useDarkModeContext()

	const handleApply = async () => {
		if (applyStatus !== ApplyStatus.Idle) {
			return
		}
		setApplying(true)
		onApply({
			type: 'switch_mode',
			mode: mode,
			reason: reason,
			finish: finish,
		})
	}

	return (
		<div>
			<div 
				className={`infio-chat-code-block has-filename`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<div className={'infio-chat-code-block-header'}>
					<div 
						className={'infio-chat-code-block-header-filename'}
						onClick={() => toolExecutionResult && setIsResultOpen(!isResultOpen)}
						style={{ cursor: toolExecutionResult && isHovered ? 'pointer' : 'default' }}
					>
						{toolExecutionResult && isHovered ? (
							isResultOpen ? <ChevronDown size={10} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={10} className="infio-chat-code-block-header-icon" />
						) : (
							<Settings2 size={10} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.switchToMode').replace('{mode}', mode.charAt(0).toUpperCase() + mode.slice(1))}
					</div>
				<div className={'infio-chat-code-block-header-button'}>
					<button
						onClick={handleApply}
						style={{ color: '#008000' }}
						disabled={applyStatus !== ApplyStatus.Idle || applying}
					>
						{applyStatus === ApplyStatus.Idle ? (
							applying ? (
								<>
									<Loader2 className="spinner" size={14} /> {t('chat.reactMarkdown.allowing')}
								</>
							) : (
								t('chat.reactMarkdown.allow')
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
				<MemoizedSyntaxHighlighterWrapper
					isDarkMode={isDarkMode}
					language="markdown"
					hasFilename={true}
					wrapLines={true}
					isOpen={true}
				>
					{reason}
				</MemoizedSyntaxHighlighterWrapper>
			</div>
			{/* 工具执行结果显示区域 */}
			{toolExecutionResult && isResultOpen && (
				<div style={{ marginTop: '8px' }}>
					<MarkdownToolResult
						content={toolExecutionResult.content}
						toolName={toolExecutionResult.type}
					/>
				</div>
			)}
		</div>
	)
}
