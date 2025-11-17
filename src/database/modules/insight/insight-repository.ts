import { PGliteInterface } from '@electric-sql/pglite'
import { App } from 'obsidian'

import { EmbeddingModel } from '../../../types/embedding'
import { DatabaseNotInitializedException } from '../../exception'
import { InsertSourceInsight, SelectSourceInsight, sourceInsightTables } from '../../schema'

export class InsightRepository {
  private app: App
  private db: PGliteInterface | null

  constructor(app: App, pgClient: PGliteInterface | null) {
    this.app = app
    this.db = pgClient
  }

  private getTableName(embeddingModel: EmbeddingModel): string {
    const tableDefinition = sourceInsightTables[embeddingModel.dimension]
    if (!tableDefinition) {
      throw new Error(`No source insight table definition found for model: ${embeddingModel.id}`)
    }
    return tableDefinition.name
  }

  async getAllInsights(embeddingModel: EmbeddingModel): Promise<SelectSourceInsight[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    
    // 分批加载避免内存问题
    const batchSize = 100
    let offset = 0
    const allInsights: SelectSourceInsight[] = []
    
    while (true) {
      const result = await this.db.query<SelectSourceInsight>(
        `SELECT id, insight, insight_type, source_path, source_type, created_at, updated_at 
         FROM "${tableName}" ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
        [batchSize, offset]
      )
      
      if (result.rows.length === 0) {
        break
      }
      
      allInsights.push(...result.rows)
      offset += batchSize
      
      // 每500条记录输出一次进度日志
      if (allInsights.length % 500 === 0) {
        console.log(`📊 Insights加载进度: ${allInsights.length} 条记录`)
      }
      
      // 避免无限循环
      if (result.rows.length < batchSize) {
        break
      }
    }
    
    return allInsights
  }

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
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    
    // 获取总数
    const countResult = await this.db.query<{count: number}>(
      `SELECT COUNT(*) as count FROM "${tableName}"`
    )
    const totalCount = countResult.rows[0].count
    const totalPages = Math.ceil(totalCount / pageSize)
    const currentPage = Math.min(Math.max(1, page), totalPages)
    const offset = (currentPage - 1) * pageSize
    
    // 获取分页数据
    const result = await this.db.query<SelectSourceInsight>(
      `SELECT id, insight, insight_type, source_path, source_type, created_at, updated_at 
       FROM "${tableName}" ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [pageSize, offset]
    )
    
    return {
      insights: result.rows,
      totalCount,
      totalPages,
      currentPage
    }
  }

  async getInsightsBySourcePath(
    sourcePath: string,
    embeddingModel: EmbeddingModel,
  ): Promise<SelectSourceInsight[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    const result = await this.db.query<SelectSourceInsight>(
      `SELECT * FROM "${tableName}" WHERE source_path = $1 ORDER BY created_at DESC`,
      [sourcePath]
    )
    return result.rows
  }

  async getInsightsByType(
    insightType: string,
    embeddingModel: EmbeddingModel,
  ): Promise<SelectSourceInsight[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    const result = await this.db.query<SelectSourceInsight>(
      `SELECT * FROM "${tableName}" WHERE insight_type = $1 ORDER BY created_at DESC`,
      [insightType]
    )
    return result.rows
  }

  async getInsightsBySourceType(
    sourceType: 'document' | 'tag' | 'folder',
    embeddingModel: EmbeddingModel,
  ): Promise<SelectSourceInsight[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    const result = await this.db.query<SelectSourceInsight>(
      `SELECT * FROM "${tableName}" WHERE source_type = $1 ORDER BY created_at DESC`,
      [sourceType]
    )
    return result.rows
  }

  async deleteInsightsBySourcePath(
    sourcePath: string,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    await this.db.query(
      `DELETE FROM "${tableName}" WHERE source_path = $1`,
      [sourcePath]
    )
  }

  async deleteInsightsBySourcePaths(
    sourcePaths: string[],
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    await this.db.query(
      `DELETE FROM "${tableName}" WHERE source_path = ANY($1)`,
      [sourcePaths]
    )
  }

  async deleteInsightsByType(
    insightType: string,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    await this.db.query(
      `DELETE FROM "${tableName}" WHERE insight_type = $1`,
      [insightType]
    )
  }

  async clearAllInsights(embeddingModel: EmbeddingModel): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    await this.db.query(`DELETE FROM "${tableName}"`)
  }

  async deleteInsightById(
    id: number,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    await this.db.query(
      `DELETE FROM "${tableName}" WHERE id = $1`,
      [id]
    )
  }

  async insertInsights(
    data: InsertSourceInsight[],
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)

    // 构建批量插入的 SQL
    const values = data.map((insight, index) => {
      const offset = index * 7
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
    }).join(',')

    const params = data.flatMap(insight => [
      insight.insight_type,
      insight.insight.replace(/\0/g, ''), // 清理null字节
      insight.source_type,
      insight.source_path,
      insight.source_mtime,
      `[${insight.embedding.join(',')}]`,  // 转换为PostgreSQL vector格式
      new Date() // updated_at
    ])

    await this.db.query(
      `INSERT INTO "${tableName}" (insight_type, insight, source_type, source_path, source_mtime, embedding, updated_at)
       VALUES ${values}`,
      params
    )
  }

  async updateInsight(
    id: number,
    data: Partial<InsertSourceInsight>,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)

    const fields: string[] = []
    const params: unknown[] = []
    let paramIndex = 1

    if (data.insight_type !== undefined) {
      fields.push(`insight_type = $${paramIndex}`)
      params.push(data.insight_type)
      paramIndex++
    }

    if (data.insight !== undefined) {
      fields.push(`insight = $${paramIndex}`)
      params.push(data.insight.replace(/\0/g, ''))
      paramIndex++
    }

    if (data.source_type !== undefined) {
      fields.push(`source_type = $${paramIndex}`)
      params.push(data.source_type)
      paramIndex++
    }

    if (data.source_path !== undefined) {
      fields.push(`source_path = $${paramIndex}`)
      params.push(data.source_path)
      paramIndex++
    }

    if (data.source_mtime !== undefined) {
      fields.push(`source_mtime = $${paramIndex}`)
      params.push(data.source_mtime)
      paramIndex++
    }

    if (data.embedding !== undefined) {
      fields.push(`embedding = $${paramIndex}`)
      params.push(`[${data.embedding.join(',')}]`)
      paramIndex++
    }

    fields.push(`updated_at = $${paramIndex}`)
    params.push(new Date())
    paramIndex++

    params.push(id)

    await this.db.query(
      `UPDATE "${tableName}" SET ${fields.join(', ')} WHERE id = $${paramIndex}`,
      params
    )
  }

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
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)

    const whereConditions: string[] = ['1 - (embedding <=> $1::vector) > $2']
    const params: unknown[] = [`[${queryVector.join(',')}]`, options.minSimilarity, options.limit]
    let paramIndex = 4

    if (options.insightTypes && options.insightTypes.length > 0) {
      whereConditions.push(`insight_type = ANY($${paramIndex})`)
      params.push(options.insightTypes)
      paramIndex++
    }

    if (options.sourceTypes && options.sourceTypes.length > 0) {
      whereConditions.push(`source_type = ANY($${paramIndex})`)
      params.push(options.sourceTypes)
      paramIndex++
    }

    if (options.sourcePaths && options.sourcePaths.length > 0) {
      whereConditions.push(`source_path = ANY($${paramIndex})`)
      params.push(options.sourcePaths)
      paramIndex++
    }

    const query = `
      SELECT 
        id, insight_type, insight, source_type, source_path, source_mtime, created_at, updated_at,
        1 - (embedding <=> $1::vector) as similarity
      FROM "${tableName}"
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY similarity DESC
      LIMIT $3
    `

    type SearchResult = Omit<SelectSourceInsight, 'embedding'> & { similarity: number }
    const result = await this.db.query<SearchResult>(query, params)
    return result.rows
  }

  // async getInsightsByMtimeRange(
  //   minMtime: number,
  //   maxMtime: number,
  //   embeddingModel: EmbeddingModel,
  // ): Promise<SelectSourceInsight[]> {
  //   if (!this.db) {
  //     throw new DatabaseNotInitializedException()
  //   }
  //   const tableName = this.getTableName(embeddingModel)
  //   const result = await this.db.query<SelectSourceInsight>(
  //     `SELECT * FROM "${tableName}" WHERE source_mtime >= $1 AND source_mtime <= $2 ORDER BY created_at DESC`,
  //     [minMtime, maxMtime]
  //   )
  //   return result.rows
  // }

  // async getOutdatedInsights(
  //   sourcePath: string,
  //   currentMtime: number,
  //   embeddingModel: EmbeddingModel,
  // ): Promise<SelectSourceInsight[]> {
  //   if (!this.db) {
  //     throw new DatabaseNotInitializedException()
  //   }
  //   const tableName = this.getTableName(embeddingModel)
  //   const result = await this.db.query<SelectSourceInsight>(
  //     `SELECT * FROM "${tableName}" WHERE source_path = $1 AND source_mtime < $2 ORDER BY created_at DESC`,
  //     [sourcePath, currentMtime]
  //   )
  //   return result.rows
  // }
} 
