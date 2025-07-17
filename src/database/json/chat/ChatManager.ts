import { App } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'
import sanitize from 'sanitize-basename'
import unsanitize from 'unsanitize-basename'

import { ChatConversationMeta } from '../../../types/chat'
import { AbstractJsonRepository } from '../base'
import { CHAT_DIR, ROOT_DIR } from '../constants'
import { EmptyChatTitleException } from '../exception'
import { WorkspaceManager } from '../workspace/WorkspaceManager'

import {
	CHAT_SCHEMA_VERSION,
	ChatConversation
} from './types'

export class ChatManager extends AbstractJsonRepository<
	ChatConversation,
	ChatConversationMeta
> {
	private workspaceManager?: WorkspaceManager

	constructor(app: App, workspaceManager?: WorkspaceManager) {
		super(app, `${ROOT_DIR}/${CHAT_DIR}`)
		this.workspaceManager = workspaceManager
	}

	protected generateFileName(chat: ChatConversation): string {
		// 新格式 v2: v{schemaVersion}_{sanitizedTitle}_{updatedAt}_{id}_{workspaceId}.json
		const sanitizedTitle = sanitize(chat.title, { maxLength: 100 })
		// 如果没有工作区，使用 'vault' 作为默认值
		const workspaceId = chat.workspace || 'vault'
		return `v${chat.schemaVersion}_${sanitizedTitle}_${chat.updatedAt}_${chat.id}_${workspaceId}.json`
	}

	protected parseFileName(fileName: string): ChatConversationMeta | null {
		// 通过头两个字符判断版本
		if (fileName.startsWith('v2_')) {
			return this.parseFileNameV2(fileName)
		} else if (fileName.startsWith('v1_')) {
			return this.parseFileNameV1(fileName)
		}
		
		return null
	}

	/**
	 * 解析新版本 (v2) 文件名
	 * 格式: v2_{sanitizedTitle}_{updatedAt}_{id}_{workspaceId}.json
	 */
	private parseFileNameV2(fileName: string): ChatConversationMeta | null {
		const regex = new RegExp(
			`^v2_(.+)_(\\d+)_([0-9a-f-]+)(?:_([^_]+))?\\.json$`,
		)
		const match = fileName.match(regex)

		if (!match) return null

		try {
			// 使用 unsanitize-basename 还原原始标题
			const title = unsanitize(match[1])
			const updatedAt = parseInt(match[2], 10)
			const id = match[3]
			const workspaceId = match[4] // 可能为undefined（老格式）

			return {
				id,
				schemaVersion: 2,
				title,
				updatedAt,
				createdAt: 0,
				// 如果没有工作区信息（老格式），则认为是vault（全局消息）
				workspace: workspaceId === 'vault' ? undefined : workspaceId,
			}
		} catch (error) {
			console.warn('Failed to unsanitize filename:', fileName, error)
			return null
		}
	}

	/**
	 * 解析旧版本 (v1) 文件名
	 * 格式: v1_{encodedTitle}_{updatedAt}_{id}_{workspaceId}.json
	 */
	private parseFileNameV1(fileName: string): ChatConversationMeta | null {
		const regex = new RegExp(
			`^v1_(.+)_(\\d+)_([0-9a-f-]+)(?:_([^_]+))?\\.json$`,
		)
		const match = fileName.match(regex)

		if (!match) return null

		try {
			// 旧版本使用 decodeURIComponent
			const title = decodeURIComponent(match[1])
			const updatedAt = parseInt(match[2], 10)
			const id = match[3]
			const workspaceId = match[4] // 可能为undefined（老格式）

			return {
				id,
				schemaVersion: 1,
				title,
				updatedAt,
				createdAt: 0,
				// 如果没有工作区信息（老格式），则认为是vault（全局消息）
				workspace: workspaceId === 'vault' ? undefined : workspaceId,
			}
		} catch (error) {
			console.warn('Failed to decode v1 filename:', fileName, error)
			return null
		}
	}

	public async createChat(
		initialData: Partial<ChatConversation>,
	): Promise<ChatConversation> {
		if (initialData.title && initialData.title.length === 0) {
			throw new EmptyChatTitleException()
		}

		const now = Date.now()
		const newChat: ChatConversation = {
			id: uuidv4(),
			title: 'New chat',
			messages: [],
			createdAt: now,
			updatedAt: now,
			schemaVersion: CHAT_SCHEMA_VERSION,
			...initialData,
		}

		await this.create(newChat)

		// 如果有工作区信息，添加到工作区的聊天历史中
		if (newChat.workspace && this.workspaceManager) {
			try {
				await this.workspaceManager.addChatToWorkspace(
					newChat.workspace,
					newChat.id,
					newChat.title
				)
			} catch (error) {
				console.error('Failed to add chat to workspace:', error)
			}
		}

		return newChat
	}

	public async findById(id: string): Promise<ChatConversation | null> {
		const allMetadata = await this.listMetadata()
		const targetMetadatas = allMetadata.filter((meta) => meta.id === id)

		if (targetMetadatas.length === 0) return null

		// Sort by updatedAt descending to find the latest version
		targetMetadatas.sort((a, b) => b.updatedAt - a.updatedAt)
		const latestMetadata = targetMetadatas[0]

		return this.read(latestMetadata.fileName)
	}

	public async updateChat(
		id: string,
		updates: Partial<
			Omit<ChatConversation, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
		>,
	): Promise<ChatConversation | null> {
		const chat = await this.findById(id)
		if (!chat) return null

		if (updates.title !== undefined && updates.title.length === 0) {
			throw new EmptyChatTitleException()
		}

		const updatedChat: ChatConversation = {
			...chat,
			...updates,
			updatedAt: Date.now(),
		}

		await this.update(chat, updatedChat)

		// 如果标题或工作区发生变化，更新工作区的聊天历史
		if (this.workspaceManager && (updates.title !== undefined || updates.workspace !== undefined)) {
			const workspaceId = updatedChat.workspace || chat.workspace
			if (workspaceId) {
				try {
					await this.workspaceManager.addChatToWorkspace(
						workspaceId,
						updatedChat.id,
						updatedChat.title
					)
				} catch (error) {
					console.error('Failed to update chat in workspace:', error)
				}
			}
		}

		return updatedChat
	}

	public async deleteChat(id: string): Promise<boolean> {
		const allMetadata = await this.listMetadata()
		const targetsToDelete = allMetadata.filter((meta) => meta.id === id)

		if (targetsToDelete.length === 0) return false

		// 获取聊天的工作区信息（从第一个匹配的元数据中获取）
		const chatToDelete = await this.findById(id)
		const workspaceId = chatToDelete?.workspace

		// Delete all files associated with this ID
		await Promise.all(targetsToDelete.map(meta => this.delete(meta.fileName)))

		// 从工作区的聊天历史中移除
		if (workspaceId && this.workspaceManager) {
			try {
				await this.workspaceManager.removeChatFromWorkspace(workspaceId, id)
			} catch (error) {
				console.error('Failed to remove chat from workspace:', error)
			}
		}

		return true
	}

	public async cleanupOutdatedChats(): Promise<number> {
		const allMetadata = await this.listMetadata()
		const chatsById = new Map<string, (ChatConversationMeta & { fileName: string })[]>()

		// Group chats by ID
		for (const meta of allMetadata) {
			if (!chatsById.has(meta.id)) {
				chatsById.set(meta.id, [])
			}
			const chatGroup = chatsById.get(meta.id)
			if (chatGroup) {
				chatGroup.push(meta)
			}
		}

		const filesToDelete: string[] = []

		// Find outdated files for each ID
		for (const chatGroup of chatsById.values()) {
			if (chatGroup.length > 1) {
				// Sort by date to find the newest
				chatGroup.sort((a, b) => b.updatedAt - a.updatedAt)
				// The first one is the latest, the rest are outdated
				const outdatedFiles = chatGroup.slice(1)
				for (const outdated of outdatedFiles) {
					filesToDelete.push(outdated.fileName)
				}
			}
		}

		if (filesToDelete.length > 0) {
			await Promise.all(filesToDelete.map(fileName => this.delete(fileName)))
		}

		return filesToDelete.length
	}

	public async listChats(workspaceFilter?: string): Promise<ChatConversationMeta[]> {
		const metadata = await this.listMetadata()

		// Use a Map to store the latest version of each chat by ID.
		const latestChats = new Map<string, ChatConversationMeta & { fileName: string }>()

		for (const meta of metadata) {
			const existing = latestChats.get(meta.id)
			if (!existing || meta.updatedAt > existing.updatedAt) {
				latestChats.set(meta.id, meta)
			}
		}

		const uniqueMetadata = Array.from(latestChats.values())

		// 将metadata转换为ChatConversationMeta格式
		const chatMetadata: ChatConversationMeta[] = uniqueMetadata.map((meta) => ({
			id: meta.id,
			schemaVersion: meta.schemaVersion,
			title: meta.title,
			updatedAt: meta.updatedAt,
			createdAt: meta.createdAt,
			workspace: meta.workspace
		}))

		// 如果指定了工作区过滤器，则过滤对话
		let filteredMetadata = chatMetadata
		if (workspaceFilter !== undefined && workspaceFilter !== 'vault') {
			// 获取指定工作区的对话
			filteredMetadata = chatMetadata.filter(meta =>
				meta.workspace === workspaceFilter
			)
		}

		const sorted = filteredMetadata.sort((a, b) => b.updatedAt - a.updatedAt)
		return sorted
	}
}
