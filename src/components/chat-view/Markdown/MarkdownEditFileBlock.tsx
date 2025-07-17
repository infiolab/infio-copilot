import { Check, ChevronDown, ChevronRight, CopyIcon, Edit, Loader2, X } from 'lucide-react'

import * as pathUtils from 'path'

import { PropsWithChildren, useEffect, useMemo, useState } from 'react'

import { useApp } from "../../../contexts/AppContext"
import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function MarkdownEditFileBlock({
	mode,
	applyStatus,
	onApply,
	onAccept,
	onReject,
	language,
	path,
	startLine,
	endLine,
	finish,
	children,
}: PropsWithChildren<{
	mode: string
	applyStatus: ApplyStatus
	onApply: (args: ToolArgs) => void
	onAccept?: () => void
	onReject?: () => void
	language?: string
	path?: string
	startLine?: number
	endLine?: number
	finish?: boolean
}>) {
	const [copied, setCopied] = useState(false)
	const [applying, setApplying] = useState(false)
	const [isResultOpen, setIsResultOpen] = useState(true)
	const [isHovered, setIsHovered] = useState(false)
	const app = useApp()
	const { isDarkMode } = useDarkModeContext()

	const wrapLines = useMemo(() => {
		return !language || ['markdown'].includes(language)
	}, [language])

	// Auto-apply when finish is true
	useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			handleApply()
		}
	}, [finish, applyStatus])

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

	const handleAccept = async () => {
		if (applying || !path) {
			return
		}
		setApplying(true)
		try {
			// 获取或创建文件
			let opFile = app.vault.getFileByPath(path)
			let newFile = false

			if (!opFile) {
				// 确保目录结构存在
				const dir = pathUtils.dirname(path)
				if (dir && dir !== '.' && dir !== '/') {
					const dirExists = await app.vault.adapter.exists(dir)
					if (!dirExists) {
						await app.vault.adapter.mkdir(dir)
					}
				}
				opFile = await app.vault.create(path, '')
				newFile = true
			}

			// 写入内容
			await app.vault.modify(opFile, String(children))

			// 如果是新文件，在新标签页中打开
			if (newFile) {
				app.workspace.openLinkText(path, 'split', true)
			}

			// 通知成功
			if (onAccept) {
				onAccept()
			}

		} catch (error) {
			console.error('Failed to accept changes:', error)
			// TODO: 可以考虑添加错误处理，比如显示错误提示
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

					{applying && (
						<div className="infio-applying-status">
							<Loader2 className="spinner" size={14} />
						</div>
					)}

					{shouldShowEditing() && (
						<div className="infio-editing-status">
							{t('chat.reactMarkdown.editing')}
						</div>
					)}

					{shouldShowActionButtons() && (
						<>
							<button
								onClick={handleAccept}
								className="infio-apply-button infio-apply-button-primary"
								disabled={applyStatus !== ApplyStatus.Idle}
							>
								<Check size={14} />
								{t('applyView.acceptAll').replace('{{shortcut}}', '')}
							</button>
							<button
								onClick={handleReject}
								className="infio-apply-button infio-reject-button"
							>
								<X size={14} />
								{t('applyView.rejectAll').replace('{{shortcut}}', '')}
							</button>
						</>
					)}
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
