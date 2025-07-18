import * as Tooltip from '@radix-ui/react-tooltip'
import { Check, ChevronsDownUp, ChevronsUpDown, CopyIcon, Loader2, Replace, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { useApp } from '../../../contexts/AppContext'
import { useDarkModeContext } from '../../../contexts/DarkModeContext'
import { t } from '../../../lang/helpers'
import { ApplyStatus, SearchAndReplaceToolArgs } from '../../../types/apply'
import { openMarkdownFile } from '../../../utils/obsidian'

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownSearchAndReplace({
	applyStatus,
	onApply,
	onAccept,
	onReject,
	path,
	content,
	operations,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: SearchAndReplaceToolArgs) => void
	onAccept?: () => void
	onReject?: () => void
	path: string,
	content: string,
	operations: SearchAndReplaceToolArgs['operations'],
	finish: boolean
}) {
	const app = useApp()
	const { isDarkMode } = useDarkModeContext()

	const [applying, setApplying] = useState(false)
	const [copied, setCopied] = useState(false)
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const containerRef = useRef<HTMLDivElement>(null)

	// Auto-apply when finish is true
	useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			handleApply()
		}
	}, [finish, applyStatus])

	// Auto-scroll to bottom when content changes
	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
	}, [content])

	const handleClick = () => {
		openMarkdownFile(app, path)
	}

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(content)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch (err) {
			console.error('Failed to copy text: ', err)
		}
	}

	const handleApply = async () => {
		if (applying) {
			return
		}
		setApplying(true)
		try {
			onApply({
				type: 'search_and_replace',
				filepath: path,
				operations
			})
		} finally {
			// Reset applying state after operation completes
			setTimeout(() => setApplying(false), 1000)
		}
	}

	const handleAccept = async () => {
		if (applying || !onAccept) {
			return
		}
		setApplying(true)
		try {
			onAccept()
		} catch (error) {
			console.error('Failed to accept changes:', error)
		} finally {
			setApplying(false)
		}
	}

	const handleReject = () => {
		if (onReject) {
			onReject()
		}
	}

	// 获取应用状态图标
	const getStatusIcon = () => {
		if (applyStatus === ApplyStatus.Applied) {
			return <Check size={14} color="var(--color-green)" className="infio-apply-status-icon" />
		} else if (applyStatus === ApplyStatus.Failed || applyStatus === ApplyStatus.Rejected) {
			return <X size={14} color="var(--color-red)" className="infio-apply-status-icon" />
		}
		return null
	}

	// 判断是否应该显示操作按钮
	const shouldShowActionButtons = () => {
		return finish && !applying
	}

	// 判断是否应该显示编辑状态
	const shouldShowEditing = () => {
		return !finish && !applying
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
							if (isHovered) {
								e.stopPropagation()
								setIsResultOpen(!isResultOpen)
							} else {
								handleClick()
							}
						}}
					>
						{isHovered ? (
							isResultOpen ? <ChevronsDownUp size={10} className="infio-chat-code-block-header-icon" /> : <ChevronsUpDown size={10} className="infio-chat-code-block-header-icon" />
						) : (
							<Replace size={10} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.searchAndReplaceInPath').replace('{path}', path)}
						{getStatusIcon()}
					</div>
					<div className={'infio-chat-code-block-header-button'}>
						{(applying || shouldShowEditing()) && (
							<div className="infio-applying-status">
								<Loader2 className="spinner" size={14} />
							</div>
						)}

						{shouldShowActionButtons() && (
							<>
								<Tooltip.Provider delayDuration={0}>
									<Tooltip.Root>
										<Tooltip.Trigger asChild>
											<button
												onClick={() => {
													handleCopy()
												}}
											>
												{copied ? (
													<>
														<CopyIcon size={14} color="var(--color-green)" />
													</>
												) : (
													<>
														<CopyIcon size={14} />
													</>
												)}
											</button>
										</Tooltip.Trigger>
										<Tooltip.Portal>
											<Tooltip.Content className="infio-tooltip-content">
												{t('chat.reactMarkdown.copy')}
											</Tooltip.Content>
										</Tooltip.Portal>
									</Tooltip.Root>
								</Tooltip.Provider>
								{
									applyStatus === ApplyStatus.Idle && (
										<>
											<Tooltip.Provider delayDuration={0}>
												<Tooltip.Root>
													<Tooltip.Trigger asChild>
														<button
															onClick={handleReject}
														>
															<X size={14} />
														</button>
													</Tooltip.Trigger>
													<Tooltip.Portal>
														<Tooltip.Content className="infio-tooltip-content">
															{t('applyView.rejectAll').replace('{{shortcut}}', '')}
														</Tooltip.Content>
													</Tooltip.Portal>
												</Tooltip.Root>
											</Tooltip.Provider>
											<button
												onClick={handleAccept}
												className="infio-apply-button infio-apply-button-primary"
												disabled={applyStatus !== ApplyStatus.Idle}
											>
												<Check size={14} />
												{t('applyView.acceptAll').replace('{{shortcut}}', '')}
											</button>
										</>
									)
								}
							</>
						)}
					</div>
				</div>
				<div
					ref={containerRef}
					className={`infio-reasoning-content-wrapper ${isResultOpen ? 'expanded' : 'collapsed'}`}
				>
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={!!path}
						wrapLines={true}
						isOpen={true}
					>
						{content}
					</MemoizedSyntaxHighlighterWrapper>
				</div>
			</div>
		</div>
	)
} 
