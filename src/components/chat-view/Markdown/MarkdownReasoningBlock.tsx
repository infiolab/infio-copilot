import { Brain, ChevronDown, ChevronRight } from 'lucide-react'
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
	const [isHovered, setIsHovered] = useState(false)

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
	}, [reasoningContent])

	return (
		reasoningContent && (
			<div
				className={`infio-chat-code-block infio-reasoning-content-block has-filename infio-reasoning-block`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<div className={'infio-chat-code-block-header'}>
					<div 
						className={'infio-chat-code-block-header-filename'}
						onClick={() => setIsOpen(!isOpen)}
						style={{ cursor: isHovered ? 'pointer' : 'default' }}
					>
						{isHovered ? (
							isOpen ? <ChevronDown size={10} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={10} className="infio-chat-code-block-header-icon" />
						) : (
							<Brain size={10} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.reasoning')}
					</div>
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
