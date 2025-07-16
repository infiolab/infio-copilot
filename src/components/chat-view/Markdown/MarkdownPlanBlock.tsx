import { AlignLeft, ChevronDown, ChevronRight } from 'lucide-react'
import { PropsWithChildren, useEffect, useRef, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownPlanBlock({
	planContent,
}: PropsWithChildren<{
	planContent: string
}>) {
	const { isDarkMode } = useDarkModeContext()
	const containerRef = useRef<HTMLDivElement>(null)
	const [isOpen, setIsOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
	}, [planContent])

	return (
		planContent && (
			<div
				className={`infio-chat-code-block infio-plan-block has-filename infio-reasoning-block`}
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
							isOpen ? <ChevronDown size={12} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={12} className="infio-chat-code-block-header-icon" />
						) : (
							<AlignLeft size={12} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.plan')}
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
						{planContent}
					</MemoizedSyntaxHighlighterWrapper>
				</div>
			</div>
		)
	)
}
