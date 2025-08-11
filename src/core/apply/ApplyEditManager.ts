import * as pathUtils from 'path'
import { App } from 'obsidian'

import { ApplyViewState } from '../../ApplyView'
import { APPLY_VIEW_TYPE } from '../../constants'
import { EditLog, EditLogManager, EditLogStatus } from '../../database/json/edit-log'
import {
	ApplyDiffToolArgs,
	EditFileToolArgs,
	InsertContentToolArgs,
	SearchAndReplaceToolArgs,
	ToolArgs,
	WriteToFileToolArgs
} from '../../types/apply'
import { LLMModel } from '../../types/llm/model'
import { LLMRequestNonStreaming } from '../../types/llm/request'
import { InfioSettings } from '../../types/settings'
import { ApplyEditToFile, SearchAndReplace } from '../../utils/apply'
import { readTFileContent } from '../../utils/obsidian'
import { DiffStrategy } from '../diff/DiffStrategy'
import LLMManager from '../llm/manager'

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
	private llmManager: LLMManager
	private settings: InfioSettings
	private statusChangeListeners: Map<string, EditStatusChangeListener[]> = new Map()

	constructor(app: App, diffStrategy: DiffStrategy, llmManager: LLMManager, settings: InfioSettings) {
		this.app = app
		this.editLogManager = new EditLogManager(app)
		this.diffStrategy = diffStrategy
		this.llmManager = llmManager
		this.settings = settings
		console.log('[ApplyEditManager] Construction completed successfully')
	}

	/**
	 * 注册编辑状态变化监听器
	 */
	onEditStatusChange(editId: string, listener: EditStatusChangeListener): void {
		if (!this.statusChangeListeners.has(editId)) {
			this.statusChangeListeners.set(editId, [])
		}
		const listeners = this.statusChangeListeners.get(editId)
		if (listeners) {
			listeners.push(listener)
		}
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

		// 检查 toolArgs 是否有 filepath 属性
		if (!('filepath' in toolArgs)) {
			throw new Error(`Tool type ${toolArgs.type} does not support file operations`)
		}

		// 获取文件原始内容
		let originalContent = ''
		const file = this.app.vault.getFileByPath(toolArgs.filepath)
		if (file) {
			originalContent = await readTFileContent(file, this.app.vault)
		}

		const editLog = await this.editLogManager.createEditLog({
			msgId,
			type: toolArgs.type,
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

		// 检查是否已缓存新内容，如果没有则计算并缓存
		let newContent = log.newContent
		if (!newContent) {
			newContent = await this.calculateNewContent(log)
			// 缓存计算结果到 EditLog
			await this.editLogManager.updateNewContent(editId, newContent)
		}

		// 检查参数是否有 filepath 属性
		if (!('filepath' in log.params)) {
			throw new Error(`Edit log ${editId} does not have filepath parameter`)
		}

		// 打开ApplyView
		const leaf = this.app.workspace.getLeaf(true)
		await leaf.setViewState({
			type: APPLY_VIEW_TYPE,
			active: true,
			state: {
				file: log.params.filepath,
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

		// 检查参数是否有 filepath 属性
		if (!('filepath' in log.params)) {
			throw new Error(`Edit log ${editId} does not have filepath parameter`)
		}

		try {
			// 使用缓存的新内容，如果没有缓存则计算
			let newContent = log.newContent
			if (!newContent) {
				newContent = await this.calculateNewContent(log)
				// 缓存计算结果
				await this.editLogManager.updateNewContent(editId, newContent)
			}

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

		// 检查参数是否有 filepath 属性
		if (!('filepath' in log.params)) {
			throw new Error(`Edit log ${editId} does not have filepath parameter`)
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
			const viewState = leaf.view.getState()
			if (typeof viewState === 'object' && viewState !== null && 'editId' in viewState) {
				return (viewState as { editId: string }).editId === editId
			}
			return false
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
				return writeParams.content || ''
			}

			case 'insert_content': {
				const insertParams = params as InsertContentToolArgs
				return await ApplyEditToFile(
					originalContent,
					insertParams.content || '',
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
					throw new Error(`Failed to apply diff`)
				}
				return result.content
			}

			case 'edit_file': {
				const editParams = params as EditFileToolArgs
				
				// 构建编辑模型
				const editModel: LLMModel = {
					provider: this.settings.editModelProvider,
					modelId: this.settings.editModelId,
				}

				const systemMessage = {
					role: 'system',
					content: `You are a hyper-specialized, automated text-merging engine. You function as a surgical \`patch\` utility. Your behavior must be 100% deterministic and precise.

**The Golden Rule:** Your single most important directive is: **Only the lines present in the \`<update>\` snippet can be different in the final output. All other lines from the original \`<code>\` block MUST be preserved verbatim, character-for-character.** You do not have creative license.

You will receive input in a strict XML format: \`<instruction>\`, \`<code>\`, and \`<update>\`.

**Understanding the Context Markers (\`// ... existing content ...\`):**

					* The markers are ** placeholders **, not real content.They show how the snippet fits into the original file.
* A marker at the ** start ** of \`<update>\` means the original file has unchanged content * before * the snippet.
* A marker at the ** end ** of \`<update>\` means the original file has unchanged content * after * the snippet.
* Your job is to find the exact, corresponding lines in \`<code>\` that match the non - marker lines in \`<update>\` and perform a precise replacement.

** CRITICAL RULES:**

					1. ** ADHERE TO THE GOLDEN RULE:** Never add, remove, or modify * any * content not explicitly part of the \`<update>\` snippet.Do not fix typos, change formatting, or refactor code outside the scope of the update.
2. ** OUTPUT THE COMPLETE FILE:** Your response MUST be the full, complete content of the file after the edit.
3. ** RAW OUTPUT ONLY:** Your entire response must be the raw content of the final file.Do not include * any * other text, explanations, or markdown code fences(\`\`\`).
4.  **PRESERVE FORMATTING:** All original indentation, spacing, and line endings for the unchanged parts of the file MUST be maintained exactly.`
				}

				// 构建请求消息
				const messages: any[] = []
				
				// 当模型不是 "infio/edit" 时，添加 system message
				if (this.settings.editModelId !== "infio/edit") {
					messages.push(systemMessage)
				}
				
				messages.push({
					role: 'user',
					content: `<instruction>${editParams.instruction}</instruction>
<code>${originalContent}</code>
<update>${editParams.content_changes}</update>`
				})

				const request: LLMRequestNonStreaming = {
					model: this.settings.editModelId,
					messages: messages,
					stream: false
				}

				// 调用 LLM 进行编辑
				const response = await this.llmManager.generateResponse(editModel, request)
				
				// 返回编辑后的内容
				return response.choices[0].message.content || originalContent
			}

			default:
				throw new Error(`Unsupported edit type: ${String(log.type)}`)
		}
	}
} 
