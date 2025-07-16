import { Check, Copy, FileIcon, FolderPlus, Loader2, Move, Trash2, X } from 'lucide-react'
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

	return (
		<div className={`infio-chat-code-block infio-manage-files-block has-filename`}>
			<div className={'infio-chat-code-block-header'}>
				<div className={'infio-chat-code-block-header-filename'}>
					<FolderPlus size={14} className="infio-chat-code-block-header-icon" />
					文件管理操作 ({operations.length} 个操作)
				</div>
				<div className={'infio-chat-code-block-header-button'}>
					<button
						onClick={handleApply}
						className="infio-apply-button"
						disabled={applyStatus !== ApplyStatus.Idle || applying || !finish}
					>
						{
							!finish ? (
								<>
									<Loader2 className="spinner" size={14} /> 准备执行
								</>
							) : applyStatus === ApplyStatus.Idle ? (
								applying ? (
									<>
										<Loader2 className="spinner" size={14} /> 执行中
									</>
								) : (
									'执行操作'
								)
							) : applyStatus === ApplyStatus.Applied ? (
								<>
									<Check size={14} /> 已完成
								</>
							) : (
								<>
									<X size={14} /> 执行失败
								</>
							)}
					</button>
				</div>
			</div>
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
		</div>
	)
} 
