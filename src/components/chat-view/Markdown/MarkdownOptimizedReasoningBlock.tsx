import { Brain, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { PropsWithChildren, useEffect, useRef, useState } from 'react'

import { t } from '../../../lang/helpers'

import RawMarkdownBlock from './RawMarkdownBlock'

export default function MarkdownOptimizedReasoningBlock({
	reasoningContent,
	isFinished = true,
	blockType = 'thinking'
}: PropsWithChildren<{
	reasoningContent: string
	isFinished?: boolean
	blockType?: 'thinking' | 'think'
}>) {
	const containerRef = useRef<HTMLDivElement>(null)
	// When not finished, default to expanded; when finished, default to collapsed
	const [isOpen, setIsOpen] = useState(!isFinished)
	const [isHovered, setIsHovered] = useState(false)

	// Update isOpen when isFinished changes
	useEffect(() => {
		if (isFinished && isOpen) {
			// When reasoning finishes, keep current state (don't auto-collapse if user opened it)
			// Only auto-collapse if it was auto-expanded due to loading
		} else if (!isFinished && !isOpen) {
			// Auto-expand when not finished
			setIsOpen(true)
		}
	}, [isFinished])

	useEffect(() => {
		if (containerRef.current && isOpen && reasoningContent) {
			// 滚动到思考框的底部
			const scrollElement = containerRef.current.querySelector('.infio-reasoning-markdown-wrapper')
			if (scrollElement) {
				// 使用 setTimeout 确保 DOM 更新完成后再滚动
				setTimeout(() => {
					scrollElement.scrollTop = scrollElement.scrollHeight
				}, 50)
			}
		}
	}, [reasoningContent, isOpen])

	const getIcon = () => {
		if (isHovered) {
			return isOpen ? <ChevronDown size={14} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={14} className="infio-chat-code-block-header-icon" />
		}

		if (!isFinished) {
			return <Loader2 className="spinner" size={14} />
		}

		return <Brain size={14} className="infio-chat-code-block-header-icon" />
	}

	const getTitle = (): string => {
		const baseTitle = blockType === 'think' ? t('chat.reactMarkdown.reasoning') : t('chat.reactMarkdown.thinking')
		if (!isFinished) {
			return `${baseTitle} - ${t('chat.reactMarkdown.loading')}`
		}
		return baseTitle
	}

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
						{getIcon()}
						{getTitle()}
					</div>
				</div>
				<div
					ref={containerRef}
					className="infio-reasoning-content-wrapper"
					style={{ display: isOpen ? 'block' : 'none' }}
				>
					<div className="infio-reasoning-markdown-wrapper">
						<RawMarkdownBlock
							content={reasoningContent}
							className="infio-reasoning-markdown"
						/>
					</div>
				</div>
			</div>
		)
	)
} 
