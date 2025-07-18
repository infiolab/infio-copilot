import { App } from 'obsidian'

import * as pathUtils from 'path'

import { ApplyViewState } from '../../ApplyView'
import { APPLY_VIEW_TYPE } from '../../constants'
import { EditLog, EditLogManager, EditLogStatus } from '../../database/json/edit-log'
import {
	ApplyDiffToolArgs,
	InsertContentToolArgs,
	SearchAndReplaceToolArgs,
	ToolArgs,
	WriteToFileToolArgs
} from '../../types/apply'
import { ApplyEditToFile, SearchAndReplace } from '../../utils/apply'
import { readTFileContent } from '../../utils/obsidian'
import { DiffStrategy } from '../diff/DiffStrategy'

// 事件类型定义
export interface EditStatusChangeEvent {
	editId: string
	status: EditLogStatus
	error?: string
}

// 事件监听器类型
export type EditStatusChangeListener = (event: EditStatusChangeEvent) => void

export class ApplyEditManager {
	private app: App
	private editLogManager: EditLogManager
	private diffStrategy: DiffStrategy
	private statusChangeListeners: Map<string, EditStatusChangeListener[]> = new Map()

	constructor(app: App, diffStrategy: DiffStrategy) {
		this.app = app
		this.editLogManager = new EditLogManager(app)
		this.diffStrategy = diffStrategy
		console.log('[ApplyEditManager] Construction completed successfully')
	}

	/**
	 * 注册编辑状态变化监听器
	 */
	onEditStatusChange(editId: string, listener: EditStatusChangeListener): void {
		if (!this.statusChangeListeners.has(editId)) {
			this.statusChangeListeners.set(editId, [])
		}
		this.statusChangeListeners.get(editId)!.push(listener)
	}

	/**
	 * 移除编辑状态变化监听器
	 */
	offEditStatusChange(editId: string, listener: EditStatusChangeListener): void {
		const listeners = this.statusChangeListeners.get(editId)
		if (listeners) {
			const index = listeners.indexOf(listener)
			if (index > -1) {
				listeners.splice(index, 1)
			}
			if (listeners.length === 0) {
				this.statusChangeListeners.delete(editId)
			}
		}
	}

	/**
	 * 触发编辑状态变化事件
	 */
	private emitEditStatusChange(editId: string, status: EditLogStatus, error?: string): void {
		const listeners = this.statusChangeListeners.get(editId)
		if (listeners) {
			const event: EditStatusChangeEvent = { editId, status, error }
			listeners.forEach(listener => {
				try {
					listener(event)
				} catch (err) {
					console.error('[ApplyEditManager] Error in status change listener:', err)
				}
			})
		}
	}

	/**
	 * 等待编辑操作完成
	 */
	async waitForEditCompletion(editId: string): Promise<EditStatusChangeEvent> {
		return new Promise((resolve) => {
			const listener: EditStatusChangeListener = (event) => {
				if (event.status !== 'pending') {
					this.offEditStatusChange(editId, listener)
					resolve(event)
				}
			}
			this.onEditStatusChange(editId, listener)
		})
	}

	/**
	 * 注册一个新的编辑操作
	 */
	async registerEdit(msgId: string, toolArgs: ToolArgs): Promise<EditLog> {

		// 获取文件原始内容
		let originalContent = ''
		const file = this.app.vault.getFileByPath(toolArgs.filepath as string)
		if (file) {
			originalContent = await readTFileContent(file, this.app.vault)
		}

		const editLog = await this.editLogManager.createEditLog({
			msgId,
			type: toolArgs.type as any,
			params: toolArgs,
			originalContent,
		})

		return editLog
	}

	/**
	 * 打开或聚焦到ApplyView来展示diff
	 */
	async openApplyView(editId: string): Promise<void> {

		const log = await this.editLogManager.findByMsgId(editId)
		if (!log) {
			throw new Error(`Edit log ${editId} not found`)
		}

		// 检查是否已存在对应editId的ApplyView
		const existingLeaf = this.findApplyViewByEditId(editId)
		if (existingLeaf) {
			// 如果已存在，激活该tab
			this.app.workspace.setActiveLeaf(existingLeaf)
			return
		}

		// 计算新内容
		const newContent = await this.calculateNewContent(log)

		// 打开ApplyView
		const leaf = this.app.workspace.getLeaf(true)
		await leaf.setViewState({
			type: APPLY_VIEW_TYPE,
			active: true,
			state: {
				file: log.params.filepath as string,
				oldContent: log.originalContent || '',
				newContent: newContent,
				editId: log.id, // 传递editId给ApplyView
				onClose: (applied: boolean) => {
					if (!applied) {
						// 如果用户关闭了ApplyView而没有应用，标记为拒绝
						this.reject(editId)
					}
				},
			} satisfies ApplyViewState,
		})
	}

	/**
	 * 执行应用操作
	 */
	async apply(editId: string): Promise<void> {
		const log = await this.editLogManager.findByMsgId(editId)
		if (!log || log.status === 'applied') {
			return
		}

		try {
			const newContent = await this.calculateNewContent(log)
			let opFile = this.app.vault.getFileByPath(log.params.filepath)
			let newFile = false

			if (!opFile) {
				// 创建文件和目录
				const dir = pathUtils.dirname(log.params.filepath)
				if (dir && dir !== '.' && dir !== '/') {
					const dirExists = await this.app.vault.adapter.exists(dir)
					if (!dirExists) {
						await this.app.vault.adapter.mkdir(dir)
					}
				}
				opFile = await this.app.vault.create(log.params.filepath, '')
				newFile = true
			}

			// 应用更改
			await this.app.vault.modify(opFile, newContent)

			// 如果是新文件，在新标签页中打开
			if (newFile) {
				this.app.workspace.openLinkText(log.params.filepath, 'split', true)
			}

			// 更新状态
			await this.editLogManager.updateStatus(editId, 'applied')
			this.emitEditStatusChange(editId, 'applied')

			// 关闭ApplyView
			this.closeApplyView(editId)

		} catch (error) {
			console.error('[ApplyEditManager] apply failed:', error)
			await this.editLogManager.updateStatus(editId, 'failed')
			this.emitEditStatusChange(editId, 'failed', error instanceof Error ? error.message : String(error))
			throw error
		}
	}

	/**
	 * 拒绝操作
	 */
	async reject(editId: string): Promise<void> {
		const log = await this.editLogManager.findByMsgId(editId)
		if (!log) {
			return
		}

		await this.editLogManager.updateStatus(editId, 'rejected')
		this.emitEditStatusChange(editId, 'rejected')
		this.closeApplyView(editId)
	}

	/**
	 * 撤销操作
	 */
	async undo(editId: string): Promise<void> {
		const log = await this.editLogManager.findByMsgId(editId)
		if (!log || log.status !== 'applied') {
			return
		}

		const file = this.app.vault.getFileByPath(log.params.filepath)
		if (file && log.originalContent !== undefined) {
			await this.app.vault.modify(file, log.originalContent)
		}

		await this.editLogManager.updateStatus(editId, 'undone')
		this.emitEditStatusChange(editId, 'undone')
	}

	/**
	 * 获取编辑日志
	 */
	async getEditLog(editId: string): Promise<EditLog | null> {
		return await this.editLogManager.findByMsgId(editId)
	}

	/**
	 * 获取指定状态的编辑日志
	 */
	async getEditLogsByStatus(status: EditLogStatus): Promise<EditLog[]> {
		return await this.editLogManager.findByStatus(status)
	}

	/**
	 * 根据editId查找已存在的ApplyView
	 */
	private findApplyViewByEditId(editId: string) {
		const leaves = this.app.workspace.getLeavesOfType(APPLY_VIEW_TYPE)
		return leaves.find(leaf => {
			const viewState = leaf.view.getState() as ApplyViewState & { editId?: string }
			return viewState.editId === editId
		})
	}

	/**
	 * 关闭对应的ApplyView
	 */
	private closeApplyView(editId: string): void {
		const leaf = this.findApplyViewByEditId(editId)
		if (leaf) {
			leaf.detach()
		}
	}

	/**
	 * 根据不同操作计算最终内容
	 */
	private async calculateNewContent(log: EditLog): Promise<string> {
		const params = log.params
		const originalContent = log.originalContent || ''

		switch (log.type) {
			case 'write_to_file': {
				const writeParams = params as WriteToFileToolArgs
				return writeParams.content
			}

			case 'insert_content': {
				const insertParams = params as InsertContentToolArgs
				return await ApplyEditToFile(
					originalContent,
					insertParams.content,
					insertParams.startLine,
					insertParams.endLine
				)
			}

			case 'search_and_replace': {
				const searchReplaceParams = params as SearchAndReplaceToolArgs
				return await SearchAndReplace(originalContent, searchReplaceParams.operations)
			}

			case 'apply_diff': {
				const applyDiffParams = params as ApplyDiffToolArgs
				const result = await this.diffStrategy.applyDiff(originalContent, applyDiffParams.diff)
				if (!result.success) {
					throw new Error(`Failed to apply diff: ${result.error}`)
				}
				return result.content
			}

			default:
				throw new Error(`Unsupported edit type: ${log.type}`)
		}
	}
} 
