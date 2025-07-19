import { Check, Copy, FileIcon, FolderPlus, Loader2, Move, Trash2, X, ChevronsDownUp, ChevronsUpDown } from 'lucide-react'
import React, { useState } from 'react'

import { ApplyStatus, ManageFilesToolArgs } from "../../../types/apply"

interface ManageFilesOperation {
	action: 'create_folder' | 'move' | 'delete' | 'copy' | 'rename'
	path?: string
	source_path?: string
	destination_path?: string
	new_name?: string
}

export default function MarkdownManageFilesBlock({
	applyStatus,
	onApply,
	operations,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: ManageFilesToolArgs) => void
	operations: ManageFilesOperation[]
	finish: boolean
}) {
	const [applying, setApplying] = useState(false)
	const [isResultOpen, setIsResultOpen] = useState(true)
	const [isHovered, setIsHovered] = useState(false)

	const getOperationIcon = (action: string) => {
		switch (action) {
			case 'create_folder':
				return <FolderPlus size={14} className="infio-chat-code-block-header-icon" />
			case 'move':
				return <Move size={14} className="infio-chat-code-block-header-icon" />
			case 'delete':
				return <Trash2 size={14} className="infio-chat-code-block-header-icon" />
			case 'copy':
				return <Copy size={14} className="infio-chat-code-block-header-icon" />
			case 'rename':
				return <FileIcon size={14} className="infio-chat-code-block-header-icon" />
			default:
				return <FileIcon size={14} className="infio-chat-code-block-header-icon" />
		}
	}

	const getOperationDescription = (operation: ManageFilesOperation) => {
		switch (operation.action) {
			case 'create_folder':
				return `创建文件夹：${operation.path}`
			case 'move':
				return `移动文件：${operation.source_path} → ${operation.destination_path}`
			case 'delete':
				return `删除：${operation.path}`
			case 'copy':
				return `复制：${operation.source_path} → ${operation.destination_path}`
			case 'rename':
				return `重命名：${operation.path} → ${operation.new_name}`
			default:
				return `未知操作`
		}
	}

	const handleApply = async () => {
		if (applyStatus !== ApplyStatus.Idle) {
			return
		}
		setApplying(true)
		onApply({
			type: 'manage_files',
			operations: operations,
		})
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
	
	// 判断是否应该显示编辑状态
	const shouldShowEditing = () => {
		return !finish
	}

	// 判断是否应该显示操作按钮
	const shouldShowActionButtons = () => {
		return finish && applyStatus === ApplyStatus.Idle
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
						<FolderPlus size={14} className="infio-chat-code-block-header-icon" />
					)}
					文件管理操作 ({operations.length} 个操作)
					{getStatusIcon()}
				</div>
				<div className={'infio-chat-code-block-header-button'}>
					{shouldShowEditing() && (
						<div className="infio-applying-status">
							<Loader2 className="spinner" size={14} />
						</div>
					)}

					{shouldShowActionButtons() && (
						<button
							onClick={handleApply}
							className="infio-apply-button infio-apply-button-primary"
							disabled={applyStatus !== ApplyStatus.Idle || applying}
						>
							{applyStatus === ApplyStatus.Applied ? (
								<>
									<Check size={14} /> 已完成
								</>
							) : applyStatus === ApplyStatus.Failed ? (
								<>
									<X size={14} /> 执行失败
								</>
							) : (
								<>
									<Check size={14} /> 执行操作
								</>
							)}
						</button>
					)}
				</div>
			</div>
			<div
				className={`infio-reasoning-content-wrapper ${isResultOpen ? 'expanded' : 'collapsed'}`}
			>
				{isResultOpen && (
				<div className="infio-chat-code-block-content">
					{operations.map((operation, index) => (
						<div key={index} className="manage-files-operation">
							<div className="operation-item">
								{getOperationIcon(operation.action)}
								<span className="operation-description">
									{getOperationDescription(operation)}
								</span>
							</div>
						</div>
					))}
				</div>
				)}
			</div>
		</div>
	)
} 
