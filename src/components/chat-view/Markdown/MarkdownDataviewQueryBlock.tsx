import { Check, ChevronsDownUp, ChevronsUpDown, Database, Loader2, X } from 'lucide-react'
import React, { useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, DataviewQueryToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"
import RawMarkdownBlock from "./RawMarkdownBlock"

export default function MarkdownDataviewQueryBlock({
	applyStatus,
	onApply,
	query,
	outputFormat,
	finish,
	toolExecutionResult
}: {
	applyStatus: ApplyStatus
	onApply: (args: DataviewQueryToolArgs) => void
	query: string
	outputFormat: string
	finish: boolean
	toolExecutionResult?: {
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}
}) {
	const { isDarkMode } = useDarkModeContext()
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'dataview_query',
				query: query,
				outputFormat: outputFormat,
			})
		}
	}, [finish])

	return (
		<div
			className={`infio-chat-code-block infio-dataview-query-block has-filename`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className={'infio-chat-code-block-header'}>
				<div
					className={'infio-chat-code-block-header-filename'}
					onClick={() => setIsResultOpen(!isResultOpen)}
					style={{ cursor: isHovered ? 'pointer' : 'default' }}
				>
					{isHovered ? (
						isResultOpen ? <ChevronsDownUp size={14} className="infio-chat-code-block-header-icon" /> : <ChevronsUpDown size={14} className="infio-chat-code-block-header-icon" />
					) : (
						<Database size={14} className="infio-chat-code-block-header-icon" />
					)}
					Dataview query [{outputFormat}]
				</div>
				<div className={'infio-chat-code-block-header-button'}>
					<button
						className="infio-dataview-query-button"
						disabled={true}
					>
						{
							!finish || applyStatus === ApplyStatus.Idle ? (
								<>
									<Loader2 className="spinner" size={14} /> 执行中...
								</>
							) : applyStatus === ApplyStatus.Applied ? (
								<>
									<Check size={14} /> 完成
								</>
							) : (
								<>
									<X size={14} /> 失败
								</>
							)}
					</button>
				</div>
			</div>
			<div>
				<MemoizedSyntaxHighlighterWrapper
					isDarkMode={isDarkMode}
					language="sql"
					hasFilename={false}
					wrapLines={false}
					backgroundColor="var(--background-modifier-form-field)"
				>
					{query}
				</MemoizedSyntaxHighlighterWrapper>
				{isResultOpen && (
					<div className="infio-dataview-result-content">
						<RawMarkdownBlock
							key={"markdown-result"}
							content={String(toolExecutionResult.content)}
							className="infio-markdown"
						/>
					</div>
				)}
			</div>

			<style>{`
				.infio-dataview-result-section {
					border-top: 1px solid var(--background-modifier-border);
					margin-top: 8px;
				}
				.infio-dataview-result-header {
					cursor: pointer;
					padding: 8px 12px;
					background-color: var(--background-secondary);
					border-radius: var(--radius-s);
					margin: 8px 0 4px 0;
					user-select: none;
				}
				.infio-dataview-result-header:hover {
					background-color: var(--background-modifier-hover);
				}
				.infio-dataview-result-header-text {
					display: flex;
					align-items: center;
					gap: 6px;
					font-size: 13px;
					font-weight: 500;
					color: var(--text-normal);
				}
				.infio-dataview-result-content {
					padding: 0 4px 8px 4px;
				}
			`}</style>
		</div>
	)
} 
