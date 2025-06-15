import { ChevronDown, ChevronRight, Brain } from 'lucide-react'
import { PropsWithChildren, useEffect, useRef, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownReasoningBlock({
	reasoningContent,
}: PropsWithChildren<{
	reasoningContent: string
}>) {
	const { isDarkMode } = useDarkModeContext()
	const containerRef = useRef<HTMLDivElement>(null)
	const [isOpen, setIsOpen] = useState(false)

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
	}, [reasoningContent])

	return (
		reasoningContent && (
			<div
				className={`infio-chat-code-block has-filename infio-reasoning-block`}
			>
				<div className={'infio-chat-code-block-header'}>
					<div className={'infio-chat-code-block-header-filename'}>
						<Brain size={10} className="infio-chat-code-block-header-icon" />
						{t('chat.reactMarkdown.reasoning')}
					</div>
					<button
						className="clickable-icon infio-chat-list-dropdown"
						onClick={() => setIsOpen(!isOpen)}
					>
						{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
					</button>
				</div>
				<div
					ref={containerRef}
					className="infio-reasoning-content-wrapper"
				>
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={true}
						wrapLines={true}
						isOpen={isOpen}
					>
						{reasoningContent}
					</MemoizedSyntaxHighlighterWrapper>
				</div>
			</div>
		)
	)
}
