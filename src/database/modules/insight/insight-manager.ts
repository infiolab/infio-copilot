import { App, TFile } from 'obsidian'

import { EmbeddingModel } from '../../../types/embedding'
import { DBManager } from '../../database-manager'
import { InsertSourceInsight, SelectSourceInsight } from '../../schema'

import { InsightRepository } from './insight-repository'

export class InsightManager {
  private app: App
  private repository: InsightRepository
  private dbManager: DBManager

  constructor(app: App, dbManager: DBManager) {
    this.app = app
    this.dbManager = dbManager
    this.repository = new InsightRepository(app, dbManager.getPgClient())
  }

  /**
   * 执行洞察相似性搜索
   */
  async performSimilaritySearch(
    queryVector: number[],
    embeddingModel: EmbeddingModel,
    options: {
      minSimilarity: number
      limit: number
      insightTypes?: string[]
      sourceTypes?: ('document' | 'tag' | 'folder')[]
      sourcePaths?: string[]
    },
  ): Promise<
    (Omit<SelectSourceInsight, 'embedding'> & {
      similarity: number
    })[]
  > {
    return await this.repository.performSimilaritySearch(
      queryVector,
      embeddingModel,
      options,
    )
  }

  /**
   * 存储单个洞察
   */
  async storeInsight(
    insightData: {
      insightType: string
      insight: string
      sourceType: 'document' | 'tag' | 'folder'
      sourcePath: string
      sourceMtime: number
      embedding: number[]
    },
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    const insertData: InsertSourceInsight = {
      insight_type: insightData.insightType,
      insight: insightData.insight,
      source_type: insightData.sourceType,
      source_path: insightData.sourcePath,
      source_mtime: insightData.sourceMtime,
      embedding: insightData.embedding,
    }

    await this.repository.insertInsights([insertData], embeddingModel)
  }

  /**
   * 批量存储洞察
   */
  async storeBatchInsights(
    insightsData: Array<{
      insightType: string
      insight: string
      sourceType: 'document' | 'tag' | 'folder'
      sourcePath: string
      sourceMtime: number
      embedding: number[]
    }>,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    const insertData: InsertSourceInsight[] = insightsData.map(data => ({
      insight_type: data.insightType,
      insight: data.insight,
      source_type: data.sourceType,
      source_path: data.sourcePath,
      source_mtime: data.sourceMtime,
      embedding: data.embedding,
    }))

    await this.repository.insertInsights(insertData, embeddingModel)
  }

  /**
   * 更新现有洞察
   */
  async updateInsight(
    id: number,
    updates: {
      insightType?: string
      insight?: string
      sourceType?: 'document' | 'tag' | 'folder'
      sourcePath?: string
      sourceMtime?: number
      embedding?: number[]
    },
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    const updateData: Partial<InsertSourceInsight> = {}

    if (updates.insightType !== undefined) {
      updateData.insight_type = updates.insightType
    }
    if (updates.insight !== undefined) {
      updateData.insight = updates.insight
    }
    if (updates.sourceType !== undefined) {
      updateData.source_type = updates.sourceType
    }
    if (updates.sourcePath !== undefined) {
      updateData.source_path = updates.sourcePath
    }
    if (updates.sourceMtime !== undefined) {
      updateData.source_mtime = updates.sourceMtime
    }
    if (updates.embedding !== undefined) {
      updateData.embedding = updates.embedding
    }

    await this.repository.updateInsight(id, updateData, embeddingModel)
  }

  /**
   * 获取所有洞察
   */
  async getAllInsights(embeddingModel: EmbeddingModel): Promise<SelectSourceInsight[]> {
    return await this.repository.getAllInsights(embeddingModel)
  }

  /**
   * 获取分页洞察
   */
  async getInsightsPage(
    embeddingModel: EmbeddingModel, 
    page: number, 
    pageSize: number = 50
  ): Promise<{
    insights: SelectSourceInsight[]
    totalCount: number
    totalPages: number
    currentPage: number
  }> {
    return await this.repository.getInsightsPage(embeddingModel, page, pageSize)
  }

  /**
   * 根据源路径获取洞察
   */
  async getInsightsBySourcePath(
    sourcePath: string,
    embeddingModel: EmbeddingModel,
  ): Promise<SelectSourceInsight[]> {
    return await this.repository.getInsightsBySourcePath(sourcePath, embeddingModel)
  }

  /**
   * 根据洞察类型获取洞察
   */
  async getInsightsByType(
    insightType: string,
    embeddingModel: EmbeddingModel,
  ): Promise<SelectSourceInsight[]> {
    return await this.repository.getInsightsByType(insightType, embeddingModel)
  }

  /**
   * 根据源类型获取洞察
   */
  async getInsightsBySourceType(
    sourceType: 'document' | 'tag' | 'folder',
    embeddingModel: EmbeddingModel,
  ): Promise<SelectSourceInsight[]> {
    return await this.repository.getInsightsBySourceType(sourceType, embeddingModel)
  }

  /**
   * 删除指定源路径的所有洞察
   */
  async deleteInsightsBySourcePath(
    sourcePath: string,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    await this.repository.deleteInsightsBySourcePath(sourcePath, embeddingModel)
  }

  /**
   * 批量删除多个源路径的洞察
   */
  async deleteInsightsBySourcePaths(
    sourcePaths: string[],
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    await this.repository.deleteInsightsBySourcePaths(sourcePaths, embeddingModel)
  }

  /**
   * 删除指定类型的所有洞察
   */
  async deleteInsightsByType(
    insightType: string,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    await this.repository.deleteInsightsByType(insightType, embeddingModel)
  }

  /**
   * 清空所有洞察
   */
  async clearAllInsights(embeddingModel: EmbeddingModel): Promise<void> {
    await this.repository.clearAllInsights(embeddingModel)
  }

  /**
   * 删除指定ID的洞察
   */
  async deleteInsightById(
    id: number,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    await this.repository.deleteInsightById(id, embeddingModel)
  }

  /**
   * 文件删除时清理相关洞察
   */
  async cleanInsightsForDeletedFile(
    file: TFile,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    await this.repository.deleteInsightsBySourcePath(file.path, embeddingModel)
  }

  /**
   * 文件重命名时更新洞察路径
   */
  async updateInsightsForRenamedFile(
    oldPath: string,
    newPath: string,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    // 获取旧路径的所有洞察
    const insights = await this.repository.getInsightsBySourcePath(oldPath, embeddingModel)
    
    // 批量更新路径
    for (const insight of insights) {
      await this.repository.updateInsight(
        insight.id,
        { source_path: newPath },
        embeddingModel
      )
    }
  }

  /**
   * 清理已删除文件的洞察（批量清理）
   */
  async cleanInsightsForDeletedFiles(embeddingModel: EmbeddingModel): Promise<void> {
    const allInsights = await this.repository.getAllInsights(embeddingModel)
    const pathsToDelete: string[] = []

    for (const insight of allInsights) {
      if (insight.source_type === 'document') {
        // 检查文件是否还存在
        const file = this.app.vault.getAbstractFileByPath(insight.source_path)
        if (!file) {
          pathsToDelete.push(insight.source_path)
        }
      }
    }

    if (pathsToDelete.length > 0) {
      await this.repository.deleteInsightsBySourcePaths(pathsToDelete, embeddingModel)
    }
  }

  /**
   * 获取洞察统计信息
   */
  async getInsightStats(embeddingModel: EmbeddingModel): Promise<{
    total: number
    byType: Record<string, number>
    bySourceType: Record<string, number>
  }> {
    const allInsights = await this.repository.getAllInsights(embeddingModel)
    
    const stats = {
      total: allInsights.length,
      byType: {} as Record<string, number>,
      bySourceType: {} as Record<string, number>,
    }

    for (const insight of allInsights) {
      // 统计洞察类型
      stats.byType[insight.insight_type] = (stats.byType[insight.insight_type] || 0) + 1
      
      // 统计源类型
      stats.bySourceType[insight.source_type] = (stats.bySourceType[insight.source_type] || 0) + 1
    }

    return stats
  }

  /**
   * 搜索洞察（文本搜索，非向量搜索）
   */
  async searchInsightsByText(
    searchText: string,
    embeddingModel: EmbeddingModel,
    options?: {
      insightTypes?: string[]
      sourceTypes?: ('document' | 'tag' | 'folder')[]
      limit?: number
    }
  ): Promise<SelectSourceInsight[]> {
    // 这里可以实现基于文本的搜索逻辑
    // 目前先返回所有洞察，然后在内存中过滤
    const allInsights = await this.repository.getAllInsights(embeddingModel)
    
    let filteredInsights = allInsights.filter(insight => 
      insight.insight.toLowerCase().includes(searchText.toLowerCase()) ||
      insight.insight_type.toLowerCase().includes(searchText.toLowerCase())
    )

    if (options?.insightTypes) {
      filteredInsights = filteredInsights.filter(insight => 
        options.insightTypes!.includes(insight.insight_type)
      )
    }

    if (options?.sourceTypes) {
      filteredInsights = filteredInsights.filter(insight => 
        options.sourceTypes!.includes(insight.source_type)
      )
    }

    if (options?.limit) {
      filteredInsights = filteredInsights.slice(0, options.limit)
    }

    return filteredInsights
  }

  // /**
  //  * 根据源文件修改时间范围获取洞察
  //  */
  // async getInsightsByMtimeRange(
  //   minMtime: number,
  //   maxMtime: number,
  //   embeddingModel: EmbeddingModel,
  // ): Promise<SelectSourceInsight[]> {
  //   return await this.repository.getInsightsByMtimeRange(minMtime, maxMtime, embeddingModel)
  // }

  // /**
  //  * 根据源文件修改时间获取需要更新的洞察
  //  */
  // async getOutdatedInsights(
  //   sourcePath: string,
  //   currentMtime: number,
  //   embeddingModel: EmbeddingModel,
  // ): Promise<SelectSourceInsight[]> {
  //   return await this.repository.getOutdatedInsights(sourcePath, currentMtime, embeddingModel)
  // }
} 
