import * as Tooltip from '@radix-ui/react-tooltip'
import { Check, ChevronsDownUp, ChevronsUpDown, CopyIcon, Edit, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownLLMEditFileBlock({
	applyStatus,
	onApply,
	onAccept,
	onReject,
	path,
	instruction,
	content_changes,
	finish,
}: {
	applyStatus: ApplyStatus
	onApply: (args: ToolArgs) => void
	onAccept?: () => void
	onReject?: () => void
	path: string
	instruction: string
	content_changes: string
	finish: boolean
}) {
	const [copied, setCopied] = useState(false)
	const [applying, setApplying] = useState(false)
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)
	const { isDarkMode } = useDarkModeContext()
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
	}, [content_changes])

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(content_changes)
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
				// @ts-expect-error: ToolArgs type doesn't match the expected type but works at runtime
				type: 'edit_file',
				filepath: path,
				instruction: instruction,
				content_changes: content_changes
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
		<div
			className={`infio-chat-code-block has-filename infio-reasoning-block`}
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
						<Edit size={14} className="infio-chat-code-block-header-icon" />
					)}
					{t('chat.reactMarkdown.editOrApplyDiff').replace('{mode}', 'edit_file').replace('{path}', path)}
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
					hasFilename={true}
					wrapLines={true}
					isOpen={true}
				>
					{content_changes}
				</MemoizedSyntaxHighlighterWrapper>
			</div>
		</div>
	)
} 
