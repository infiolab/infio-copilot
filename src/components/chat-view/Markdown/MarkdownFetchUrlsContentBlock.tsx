import { Check, ChevronsDownUp, ChevronsUpDown, Globe, Loader2, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, FetchUrlsContentToolArgs } from "../../../types/apply"

import RawMarkdownBlock from "./RawMarkdownBlock"
import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownFetchUrlsContentBlock({
	applyStatus,
	onApply,
	urls,
	finish,
	toolExecutionResult
}: {
	applyStatus: ApplyStatus
	onApply: (args: FetchUrlsContentToolArgs) => void
	urls: string[],
	finish: boolean
	toolExecutionResult?: {
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const { isDarkMode } = useDarkModeContext()
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'fetch_urls_content',
				urls: urls
			})
		}
	}, [finish])

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
	}, [urls])

	return (
		urls.length > 0 && (
			<div
				className={`infio-chat-code-block infio-search-web-block has-filename`}
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
							<Globe size={14} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.fetchUrlsContent')} ({urls.length} URLs)
					</div>
					<div className={'infio-chat-code-block-header-button'}>
						<button
							style={{ color: '#008000' }}
							disabled={true}
						>
							{
								!finish || applyStatus === ApplyStatus.Idle ? (
									<>
										<Loader2 className="spinner" size={14} /> {t('chat.reactMarkdown.fetching')}
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
				<div>
					{/* URLs列表显示区域 */}
					<div
						ref={containerRef}
						className="infio-fetch-urls-list-container"
						style={{ 
							backgroundColor: "var(--background-modifier-form-field)",
							borderRadius: "var(--radius-s)",
							margin: "4px 0"
						}}
					>
						<ul className="infio-fetch-urls-list">
							{urls.map((url, index) => (
								<li key={index} className="infio-fetch-urls-list-item">
									<a
										href={url}
										target="_blank"
										rel="noopener noreferrer"
										className="infio-fetch-urls-link"
									>
										{url}
									</a>
								</li>
							))}
						</ul>
					</div>

					{/* 结果显示区域 */}
					{isResultOpen && toolExecutionResult && (
						<div className="infio-fetch-urls-result-content">
							<MemoizedSyntaxHighlighterWrapper
								key={"fetch-urls-result"}
								language="markdown"
								hasFilename={false}
								wrapLines={true}
								isOpen={true}
								isDarkMode={isDarkMode}
							>
								{String(toolExecutionResult.content)}
							</MemoizedSyntaxHighlighterWrapper>
						</div>
					)}
				</div>

				<style>{`
					.infio-fetch-urls-list-container {
						padding: 8px 12px;
					}
					.infio-fetch-urls-list {
						list-style: none;
						margin: 0;
						padding: 0;
						font-size: 13px;
					}
					.infio-fetch-urls-list-item {
						margin: 4px 0;
						padding: 2px 0;
						border-bottom: 1px solid var(--background-modifier-border-hover);
					}
					.infio-fetch-urls-list-item:last-child {
						border-bottom: none;
					}
					.infio-fetch-urls-link {
						color: var(--text-accent);
						text-decoration: none;
						word-break: break-all;
						font-family: var(--font-monospace);
						font-size: 12px;
					}
					.infio-fetch-urls-link:hover {
						color: var(--text-accent-hover);
						text-decoration: underline;
					}
					.infio-fetch-urls-result-content {
						border-top: 1px solid var(--background-modifier-border);
						padding: 0 4px 8px 4px;
						margin-top: 8px;
					}
					.infio-fetch-urls-button {
						background: transparent;
						border: none;
						color: var(--text-muted);
						font-size: 12px;
						cursor: default;
						display: flex;
						align-items: center;
						gap: 4px;
						padding: 4px 8px;
						border-radius: var(--radius-s);
					}
				`}</style>
			</div>
		)
	)
} 
