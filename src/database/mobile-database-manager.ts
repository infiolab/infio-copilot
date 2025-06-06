import { App, Notice } from 'obsidian'
import { InsertConversation, InsertMessage, SelectConversation, SelectMessage } from './schema'

// 移动端简化的数据库管理器
export class MobileDatabaseManager {
  private app: App
  private isInitialized = false

  constructor(app: App) {
    this.app = app
  }

  static async create(app: App): Promise<MobileDatabaseManager> {
    const dbManager = new MobileDatabaseManager(app)
    await dbManager.initialize()
    return dbManager
  }

  private async initialize(): Promise<void> {
    try {
      // 检查 IndexedDB 支持
      if (!('indexedDB' in window)) {
        new Notice('移动端数据库初始化失败：不支持 IndexedDB')
        return
      }
      
      this.isInitialized = true
      console.log('移动端数据库管理器初始化成功')
    } catch (error) {
      console.error('移动端数据库初始化失败:', error)
      new Notice('移动端数据库初始化失败，部分功能可能受限')
    }
  }

  // 模拟 PGlite 接口
  getPgClient(): null {
    return null // 移动端不提供 PG 客户端
  }

  // 简化的对话管理
  async saveConversation(conversation: Partial<InsertConversation>): Promise<string> {
    try {
      const conversations = this.getStoredConversations()
      const id = conversation.id || this.generateId()
      const now = new Date()
      
      conversations[id] = {
        id,
        title: conversation.title || '新对话',
        created_at: now,
        updated_at: now,
      }
      
      localStorage.setItem('infio_conversations', JSON.stringify(conversations))
      return id
    } catch (error) {
      console.error('保存对话失败:', error)
      throw error
    }
  }

  async saveMessage(message: Partial<InsertMessage>): Promise<string> {
    try {
      const messages = this.getStoredMessages()
      const id = message.id || this.generateId()
      const now = new Date()
      
      messages[id] = {
        id,
        conversation_id: message.conversationId || '',
        role: message.role || 'user',
        content: message.content || '',
        created_at: now,
        apply_status: 0, // 默认应用状态
      }
      
      localStorage.setItem('infio_messages', JSON.stringify(messages))
      return id
    } catch (error) {
      console.error('保存消息失败:', error)
      throw error
    }
  }

  async getConversations(): Promise<SelectConversation[]> {
    try {
      const conversations = this.getStoredConversations()
      return Object.values(conversations).sort((a, b) => 
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      )
    } catch (error) {
      console.error('获取对话列表失败:', error)
      return []
    }
  }

  async getMessages(conversationId: string): Promise<SelectMessage[]> {
    try {
      const messages = this.getStoredMessages()
      return Object.values(messages)
        .filter(msg => msg.conversation_id === conversationId)
        .sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
    } catch (error) {
      console.error('获取消息列表失败:', error)
      return []
    }
  }

  async deleteConversation(conversationId: string): Promise<void> {
    try {
      const conversations = this.getStoredConversations()
      delete conversations[conversationId]
      localStorage.setItem('infio_conversations', JSON.stringify(conversations))
      
      // 同时删除相关消息
      const messages = this.getStoredMessages()
      Object.keys(messages).forEach(messageId => {
        if (messages[messageId].conversation_id === conversationId) {
          delete messages[messageId]
        }
      })
      localStorage.setItem('infio_messages', JSON.stringify(messages))
    } catch (error) {
      console.error('删除对话失败:', error)
      throw error
    }
  }

  // 简化的向量搜索（移动端不支持真正的向量搜索）
  async searchSimilar(query: string, limit: number = 10): Promise<any[]> {
    try {
      // 移动端使用简单的文本匹配
      const files = this.app.vault.getMarkdownFiles()
      const results: any[] = []
      
      for (const file of files.slice(0, limit)) {
        const content = await this.app.vault.cachedRead(file)
        if (content.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            path: file.path,
            content: content.substring(0, 500), // 限制内容长度
            similarity: 0.5, // 固定相似度
          })
        }
      }
      
      return results
    } catch (error) {
      console.error('移动端搜索失败:', error)
      return []
    }
  }

  // 获取存储的对话
  private getStoredConversations(): Record<string, SelectConversation> {
    try {
      const stored = localStorage.getItem('infio_conversations')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  // 获取存储的消息
  private getStoredMessages(): Record<string, SelectMessage> {
    try {
      const stored = localStorage.getItem('infio_messages')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }

  // 生成简单 ID
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
  }

  async cleanup(): Promise<void> {
    // 移动端清理逻辑
    console.log('移动端数据库管理器已清理')
  }

  // 提供简化的管理器接口
  getVectorManager(): any {
    return {
      searchSimilar: this.searchSimilar.bind(this),
      updateVaultIndex: async () => {
        new Notice('移动端不支持向量索引，使用简化搜索')
      },
      deleteFileIndex: async () => {
        // 移动端暂不处理文件索引删除
      }
    }
  }

  getCommandManager(): any {
    return {
      // 简化的命令管理
      getCommands: async () => [],
      saveCommand: async () => {},
      deleteCommand: async () => {},
    }
  }

  getConversationManager(): any {
    return {
      saveConversation: this.saveConversation.bind(this),
      saveMessage: this.saveMessage.bind(this),
      getConversations: this.getConversations.bind(this),
      getMessages: this.getMessages.bind(this),
      deleteConversation: this.deleteConversation.bind(this),
    }
  }
} 
