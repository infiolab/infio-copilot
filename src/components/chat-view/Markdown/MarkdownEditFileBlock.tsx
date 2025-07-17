import { Check, ChevronDown, ChevronRight, CopyIcon, Edit, Loader2, X } from 'lucide-react'
import { PropsWithChildren, useMemo, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownEditFileBlock({
	mode,
	applyStatus,
	onApply,
	language,
	path,
	startLine,
	endLine,
	children,
}: PropsWithChildren<{
	mode: string
	applyStatus: ApplyStatus
	onApply: (args: ToolArgs) => void
	language?: string
	path?: string
	startLine?: number
	endLine?: number
}>) {
	const [copied, setCopied] = useState(false)
	const [applying, setApplying] = useState(false)
	const [isResultOpen, setIsResultOpen] = useState(true)
	const [isHovered, setIsHovered] = useState(false)
	const { isDarkMode } = useDarkModeContext()

	const wrapLines = useMemo(() => {
		return !language || ['markdown'].includes(language)
	}, [language])

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(String(children))
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
				type: mode,
				filepath: path,
				content: String(children),
				startLine,
				endLine
			})
		} finally {
			// Reset applying state after operation completes
			setTimeout(() => setApplying(false), 1000)
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

	// 获取应用按钮文本和样式
	const getApplyButtonContent = () => {
		if (applying) {
			return {
				text: <Loader2 className="spinner" size={14} />,
				className: 'infio-apply-button-applying',
				disabled: true
			}
		}
		
		if (applyStatus === ApplyStatus.Idle) {
			return {
				text: t('chat.reactMarkdown.apply'),
				className: 'infio-apply-button-primary',
				disabled: false
			}
		} else {
			return {
				text: t('chat.reactMarkdown.reapply'),
				className: 'infio-apply-button-secondary',
				disabled: false
			}
		}
	}

	const buttonContent = getApplyButtonContent()

	return (
		<div
			className={`infio-chat-code-block ${path ? 'has-filename' : ''}`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className={'infio-chat-code-block-header'}>
				{path && (
					<div
						className={'infio-chat-code-block-header-filename'}
						onClick={() => setIsResultOpen(!isResultOpen)}
						style={{ cursor: isHovered ? 'pointer' : 'default' }}
					>
						{isHovered ? (
							isResultOpen ? <ChevronDown size={14} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={14} className="infio-chat-code-block-header-icon" />
						) : (
							<Edit size={14} className="infio-chat-code-block-header-icon" />
						)}
						{t('chat.reactMarkdown.editOrApplyDiff').replace('{mode}', mode).replace('{path}', path)}
						{getStatusIcon()}
					</div>
				)}
				<div className={'infio-chat-code-block-header-button'}>
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
					<button
						onClick={handleApply}
						className={`infio-apply-button ${buttonContent.className}`}
						disabled={buttonContent.disabled}
					>
						{buttonContent.text}
					</button>
				</div>
			</div>
			{
				isResultOpen && (
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language={language}
						hasFilename={!!path}
						wrapLines={wrapLines}
					>
						{String(children)}
					</MemoizedSyntaxHighlighterWrapper>
				)
			}
		</div>
	)
}
