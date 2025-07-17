import { Check, ChevronDown, ChevronRight, Diff, Loader2, X } from 'lucide-react'
import { PropsWithChildren, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownApplyDiffBlock({
	mode,
	applyStatus,
	onApply,
	path,
	diff,
	finish,
}: PropsWithChildren<{
	mode: string
	applyStatus: ApplyStatus
	onApply: (args: ToolArgs) => void
	path: string
	diff: string
	finish: boolean
}>) {
	const [applying, setApplying] = useState(false)
	const [isResultOpen, setIsResultOpen] = useState(true)
	const [isHovered, setIsHovered] = useState(false)
	const { isDarkMode } = useDarkModeContext()

	const handleApply = async () => {
		if (applying || !finish) {
			return
		}
		setApplying(true)
		try {
			onApply({
				type: "apply_diff",
				filepath: path,
				diff,
				finish,
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
		if (!finish) {
			return {
				text: <><Loader2 className="spinner" size={14} /> {t('chat.reactMarkdown.loading')}</>,
				className: 'infio-apply-button-applying',
				disabled: true
			}
		}
		
		if (applying) {
			return {
				text: <><Loader2 className="spinner" size={14} /> {t('chat.reactMarkdown.applying')}</>,
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
			className={`infio-chat-code-block ${path ? 'has-filename' : ''} infio-reasoning-block`}
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
							<Diff size={14} className="infio-chat-code-block-header-icon" />
						)}
						{mode}: {path}
						{getStatusIcon()}
					</div>
				)}
				<div className={'infio-chat-code-block-header-button'}>
					<button
						onClick={handleApply}
						className={`infio-apply-button ${buttonContent.className}`}
						disabled={buttonContent.disabled}
					>
						{buttonContent.text}
					</button>
				</div>
			</div>
			{isResultOpen && (
				<div className="infio-reasoning-content-wrapper">
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="diff"
						hasFilename={!!path}
						wrapLines={true}
					>
						{diff}
					</MemoizedSyntaxHighlighterWrapper>
				</div>
			)}
		</div>
	)
}
