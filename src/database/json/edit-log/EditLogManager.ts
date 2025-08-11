import { App } from 'obsidian'

import { AbstractJsonRepository } from '../base'
import { EDIT_LOG_DIR, ROOT_DIR } from '../constants'

import {
	EDIT_LOG_SCHEMA_VERSION,
	EditLog,
	EditLogCreateInput,
	EditLogMetadata,
	EditLogStatus,
	EditLogUpdateInput
} from './types'

export class EditLogManager extends AbstractJsonRepository<EditLog, EditLogMetadata> {
	constructor(app: App) {
		super(app, `${ROOT_DIR}/${EDIT_LOG_DIR}`)
	}

	protected generateFileName(editLog: EditLog): string {
		// Format: v{schemaVersion}_{timestamp}_{msgId}.json
		return `v${EDIT_LOG_SCHEMA_VERSION}_${editLog.timestamp}_${editLog.msgId}.json`
	}

	protected parseFileName(fileName: string): EditLogMetadata | null {
		const match = fileName.match(/^v(\d+)_(\d+)_(.+)\.json$/)
		if (!match) return null

		const schemaVersion = parseInt(match[1])
		const timestamp = parseInt(match[2])
		const msgId = match[3]

		return {
			id: msgId,
			fileName,
			status: 'pending', // Default status, will be updated when reading full data
			timestamp,
			schemaVersion,
		}
	}

	/**
	 * 创建新的编辑日志
	 */
	async createEditLog(input: EditLogCreateInput): Promise<EditLog> {
		const editLog: EditLog = {
			id: input.msgId, // 使用 msgId 作为唯一标识
			msgId: input.msgId,
			type: input.type,
			params: input.params,
			status: 'pending',
			originalContent: input.originalContent,
			timestamp: Date.now(),
			schemaVersion: EDIT_LOG_SCHEMA_VERSION,
		}

		await this.create(editLog)
		return editLog
	}

	/**
	 * 根据 msgId 查找编辑日志
	 */
	async findByMsgId(msgId: string): Promise<EditLog | null> {
		const allMetadata = await this.listMetadata()
		const targetMetadata = allMetadata.find((meta) => meta.id === msgId)

		if (!targetMetadata) return null

		return this.read(targetMetadata.fileName)
	}

	/**
	 * 更新编辑日志状态
	 */
	async updateStatus(msgId: string, status: EditLogStatus): Promise<void> {
		const editLog = await this.findByMsgId(msgId)
		if (!editLog) {
			throw new Error(`Edit log not found: ${msgId}`)
		}

		const updateData: EditLogUpdateInput = { status }
		
		if (status === 'applied') {
			updateData.appliedAt = Date.now()
		} else if (status === 'rejected') {
			updateData.rejectedAt = Date.now()
		}

		const updatedEditLog: EditLog = {
			...editLog,
			...updateData,
		}

		await this.update(editLog, updatedEditLog)
	}

	/**
	 * 更新编辑日志的新内容缓存
	 */
	async updateNewContent(msgId: string, newContent: string): Promise<void> {
		const editLog = await this.findByMsgId(msgId)
		if (!editLog) {
			throw new Error(`Edit log not found: ${msgId}`)
		}

		const updatedEditLog: EditLog = {
			...editLog,
			newContent,
		}

		await this.update(editLog, updatedEditLog)
	}

	/**
	 * 获取指定状态的编辑日志
	 */
	async findByStatus(status: EditLogStatus): Promise<EditLog[]> {
		const allMetadata = await this.listMetadata()
		const allEditLogs = await Promise.all(
			allMetadata.map(async (meta) => this.read(meta.fileName))
		)
		
		return allEditLogs
			.filter((log): log is EditLog => log !== null)
			.filter(log => log.status === status)
	}

	/**
	 * 获取指定文件的编辑日志
	 */
	async findByFilePath(filePath: string): Promise<EditLog[]> {
		const allMetadata = await this.listMetadata()
		const allEditLogs = await Promise.all(
			allMetadata.map(async (meta) => this.read(meta.fileName))
		)
		
		return allEditLogs
			.filter((log): log is EditLog => log !== null)
			.filter(log => log.params.filepath === filePath)
	}

	/**
	 * 删除编辑日志
	 */
	async deleteByMsgId(msgId: string): Promise<void> {
		const editLog = await this.findByMsgId(msgId)
		if (!editLog) return

		const fileName = this.generateFileName(editLog)
		await this.delete(fileName)
	}

	/**
	 * 获取所有编辑日志
	 */
	async getAllEditLogs(): Promise<EditLog[]> {
		const allMetadata = await this.listMetadata()
		const allEditLogs = await Promise.all(
			allMetadata.map(async (meta) => this.read(meta.fileName))
		)
		
		return allEditLogs
			.filter((log): log is EditLog => log !== null)
			.sort((a, b) => b.timestamp - a.timestamp)
	}

	/**
	 * 清理过期的编辑日志（可选，比如保留最近30天的）
	 */
	async cleanup(daysToKeep: number = 30): Promise<void> {
		const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
		const allLogs = await this.getAllEditLogs()
		
		for (const log of allLogs) {
			if (log.timestamp < cutoffTime) {
				await this.deleteByMsgId(log.msgId)
			}
		}
	}
} 
