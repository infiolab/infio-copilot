import { ToolArgs } from '../../../types/apply'

export const EDIT_LOG_SCHEMA_VERSION = 1

export type EditOperationType = 'write_to_file' | 'insert_content' | 'apply_diff' | 'search_and_replace' | 'edit_file'

export type EditLogStatus = 'pending' | 'applied' | 'rejected' | 'undone' | 'failed'

export interface EditLog {
	id: string // 唯一ID，使用 msgId
	msgId: string // 关联的聊天消息ID
	type: EditOperationType // 操作类型
	params: ToolArgs // 操作所需的具体参数
	status: EditLogStatus // 当前状态
	originalContent?: string // 执行前的原始文件内容，用于undo
	newContent?: string // 计算后的新内容，用于缓存避免重复计算
	timestamp: number // 创建时间
	appliedAt?: number // 应用时间
	rejectedAt?: number // 拒绝时间
	schemaVersion: number // 数据结构版本
}

export interface EditLogMetadata {
	id: string // 对应 msgId
	fileName: string
	status: EditLogStatus
	timestamp: number
	schemaVersion: number
}

export interface EditLogCreateInput {
	msgId: string
	type: EditOperationType
	params: ToolArgs
	originalContent?: string
}

export interface EditLogUpdateInput {
	status?: EditLogStatus
	newContent?: string
	appliedAt?: number
	rejectedAt?: number
} 
