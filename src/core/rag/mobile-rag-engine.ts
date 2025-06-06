import { App, Notice, TFile } from 'obsidian'

import { MobileDatabaseManager } from '../../database/mobile-database-manager'
import { InfioSettings } from '../../types/settings'

export interface MobileQueryProgress {
  type: 'search' | 'complete'
  searchProgress?: {
    completedFiles: number
    totalFiles: number
  }
}

export class MobileRAGEngine {
  private app: App
  private settings: InfioSettings
  private dbManager: MobileDatabaseManager

  constructor(app: App, settings: InfioSettings, dbManager: MobileDatabaseManager) {
    this.app = app
    this.settings = settings
    this.dbManager = dbManager
  }

  // 添加与 RAGEngine 兼容的 processQuery 方法
  async processQuery({
    query,
    scope,
    onQueryProgressChange,
  }: {
    query: string
    scope?: {
      files: string[]
      folders: string[]
    }
    onQueryProgressChange?: (queryProgress: any) => void
  }): Promise<any[]> {
    return this.query(query, { limit: 10 }, (progress) => {
      if (onQueryProgressChange) {
        onQueryProgressChange({
          type: progress.type === 'search' ? 'querying' : 'querying-done',
          queryResult: []
        })
      }
    })
  }

  // 添加与 RAGEngine 兼容的 getEmbedding 方法
  async getEmbedding(query: string): Promise<number[]> {
    // 移动端不支持真实的embedding，返回假数据
    console.log('移动端: getEmbedding 不可用，返回模拟数据')
    return new Array(1536).fill(0).map(() => Math.random())
  }

  async query(
    query: string,
    options: {
      limit?: number
      similarityThreshold?: number
    } = {},
    progressCallback?: (progress: MobileQueryProgress) => void
  ): Promise<any[]> {
    const { limit = 10 } = options
    
    try {
      progressCallback?.({
        type: 'search',
        searchProgress: { completedFiles: 0, totalFiles: 0 }
      })

      // 移动端使用简化的文本搜索
      const files = this.app.vault.getMarkdownFiles()
      const results: any[] = []
      
      progressCallback?.({
        type: 'search',
        searchProgress: { completedFiles: 0, totalFiles: files.length }
      })

      for (let i = 0; i < Math.min(files.length, limit * 2); i++) {
        const file = files[i]
        try {
          const content = await this.app.vault.cachedRead(file)
          const searchText = query.toLowerCase()
          const fileContent = content.toLowerCase()
          
          if (fileContent.includes(searchText)) {
            // 计算简单的相关性分数
            const occurrences = (fileContent.match(new RegExp(searchText, 'g')) || []).length
            const score = Math.min(occurrences / 10, 1) // 简化评分

            results.push({
              path: file.path,
              content: this.extractRelevantSnippet(content, query),
              similarity: score,
              file: file,
              mtime: file.stat.mtime
            })
          }

          progressCallback?.({
            type: 'search',
            searchProgress: { completedFiles: i + 1, totalFiles: files.length }
          })
        } catch (error) {
          console.warn(`移动端搜索跳过文件 ${file.path}:`, error)
        }
      }

      // 按相关性排序并限制结果数量
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit)

      progressCallback?.({ type: 'complete' })
      
      return sortedResults
    } catch (error) {
      console.error('移动端 RAG 查询失败:', error)
      new Notice('移动端搜索失败，请重试')
      return []
    }
  }

  // 提取相关文本片段
  private extractRelevantSnippet(content: string, query: string, maxLength: number = 300): string {
    const queryWords = query.toLowerCase().split(/\s+/)
    const sentences = content.split(/[.!?]+/)
    
    // 找到包含查询词的句子
    const relevantSentences = sentences.filter(sentence => {
      const lowerSentence = sentence.toLowerCase()
      return queryWords.some(word => lowerSentence.includes(word))
    })

    if (relevantSentences.length === 0) {
      return content.substring(0, maxLength)
    }

    // 取前几个相关句子
    let snippet = relevantSentences.slice(0, 3).join('. ')
    if (snippet.length > maxLength) {
      snippet = snippet.substring(0, maxLength) + '...'
    }

    return snippet
  }

  async updateVaultIndex(
    options: { reindexAll?: boolean } = {},
    progressCallback?: (progress: MobileQueryProgress) => void
  ): Promise<void> {
    // 移动端简化索引更新
    progressCallback?.({ type: 'search', searchProgress: { completedFiles: 0, totalFiles: 1 } })
    
    new Notice('移动端使用实时搜索，无需预建索引', 3000)
    
    progressCallback?.({ type: 'complete' })
  }

  async deleteFileIndex(file: TFile): Promise<void> {
    // 移动端不需要删除索引
    console.log(`移动端跳过文件索引删除: ${file.path}`)
  }

  setSettings(newSettings: InfioSettings): void {
    this.settings = newSettings
  }

  cleanup(): void {
    console.log('移动端 RAG 引擎已清理')
  }

  // 获取文件统计信息
  async getIndexStats(): Promise<{ totalFiles: number, indexedFiles: number }> {
    const files = this.app.vault.getMarkdownFiles()
    return {
      totalFiles: files.length,
      indexedFiles: files.length // 移动端认为所有文件都已"索引"（实时搜索）
    }
  }

  // 搜索建议
  async getSuggestions(query: string): Promise<string[]> {
    // 移动端提供简单的搜索建议
    const files = this.app.vault.getMarkdownFiles()
    const suggestions: string[] = []
    
    for (const file of files.slice(0, 5)) {
      if (file.basename.toLowerCase().includes(query.toLowerCase())) {
        suggestions.push(file.basename)
      }
    }
    
    return suggestions
  }
} 
