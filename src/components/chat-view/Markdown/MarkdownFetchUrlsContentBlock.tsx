import { Check, ChevronDown, ChevronRight, Globe, Loader2, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { t } from '../../../lang/helpers'
import { ApplyStatus, FetchUrlsContentToolArgs } from "../../../types/apply"

export default function MarkdownFetchUrlsContentBlock({
	applyStatus,
	onApply,
	urls,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: FetchUrlsContentToolArgs) => void
	urls: string[],
	finish: boolean
}) {
	const containerRef = useRef<HTMLDivElement>(null)
	const [isOpen, setIsOpen] = useState(false)

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
			<div className="infio-chat-code-block has-filename infio-reasoning-block">
				<div className="infio-chat-code-block-header">
					<div className="infio-chat-code-block-header-filename">
						<Globe size={10} className="infio-chat-code-block-header-icon" />
						{t('chat.reactMarkdown.fetchUrlsContent')}
					</div>
					<div className="infio-chat-code-block-header-button">
						<button
							className="infio-chat-code-block-status-button"
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
						<button
							className="clickable-icon infio-chat-list-dropdown"
							onClick={() => setIsOpen(!isOpen)}
						>
							{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
						</button>
					</div>
				</div>
				<div
					ref={containerRef}
					className="infio-reasoning-content-wrapper"
					style={{ display: isOpen ? 'block' : 'none' }}
				>
					<ul className="infio-chat-code-block-url-list">
						{urls.map((url, index) => (
							<li key={index}>
								<a
									href={url}
									target="_blank"
									rel="noopener noreferrer"
									className="infio-chat-code-block-url-link"
								>
									{url}
								</a>
							</li>
						))}
					</ul>
				</div>
			</div>
		)
	)
} 
