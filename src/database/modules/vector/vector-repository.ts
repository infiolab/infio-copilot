import { PGliteInterface } from '@electric-sql/pglite'
import { App } from 'obsidian'

import { EmbeddingModel } from '../../../types/embedding'
import { DatabaseNotInitializedException } from '../../exception'
import { InsertVector, SelectVector, vectorTables } from '../../schema'

export class VectorRepository {
  private app: App
  private db: PGliteInterface | null

  constructor(app: App, pgClient: PGliteInterface | null) {
    this.app = app
    this.db = pgClient
  }

  private getTableName(embeddingModel: EmbeddingModel): string {
    const tableDefinition = vectorTables[embeddingModel.dimension]
    if (!tableDefinition) {
      throw new Error(`No table definition found for model: ${embeddingModel.id}`)
    }
    return tableDefinition.name
  }

  async getAllIndexedFilePaths(embeddingModel: EmbeddingModel): Promise<string[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    const result = await this.db.query<{ path: string }>(
      `SELECT DISTINCT path FROM "${tableName}"`
    )
    return result.rows.map((row: { path: string }) => row.path)
  }

  async getVectorsByFilePath(
    filePath: string,
    embeddingModel: EmbeddingModel,
  ): Promise<SelectVector[]> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    const result = await this.db.query<SelectVector>(
      `SELECT * FROM "${tableName}" WHERE path = $1`,
      [filePath]
    )
    return result.rows
  }

  async deleteVectorsForSingleFile(
    filePath: string,
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    await this.db.query(
      `DELETE FROM "${tableName}" WHERE path = $1`,
      [filePath]
    )
  }

  async deleteVectorsForMultipleFiles(
    filePaths: string[],
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)
    await this.db.query(
      `DELETE FROM "${tableName}" WHERE path = ANY($1)`,
      [filePaths]
    )
  }

  async clearAllVectors(embeddingModel: EmbeddingModel): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
		const tableName = this.getTableName(embeddingModel)
    await this.db.query(`DELETE FROM "${tableName}"`)
  }

  async insertVectors(
    data: InsertVector[],
    embeddingModel: EmbeddingModel,
  ): Promise<void> {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)

    // 构建批量插入的 SQL
    const values = data.map((vector, index) => {
      const offset = index * 5
      return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`
    }).join(',')

    const params = data.flatMap(vector => [
      vector.path,
      vector.mtime,
      vector.content.replace(/\0/g, ''), // 清理null字节
      `[${vector.embedding.join(',')}]`,  // 转换为PostgreSQL vector格式
      vector.metadata
    ])

    await this.db.query(
      `INSERT INTO "${tableName}" (path, mtime, content, embedding, metadata)
       VALUES ${values}`,
      params
    )
  }

  async performSimilaritySearch(
    queryVector: number[],
    embeddingModel: EmbeddingModel,
    options: {
      minSimilarity: number
      limit: number
      scope?: {
        files: string[]
        folders: string[]
      }
    },
  ): Promise<
    (Omit<SelectVector, 'embedding'> & {
      similarity: number
    })[]
  > {
    if (!this.db) {
      throw new DatabaseNotInitializedException()
    }
    const tableName = this.getTableName(embeddingModel)

    let scopeCondition = ''
    const params: any[] = [`[${queryVector.join(',')}]`, options.minSimilarity, options.limit]
    let paramIndex = 4

    if (options.scope) {
      const conditions: string[] = []

      if (options.scope.files.length > 0) {
        conditions.push(`path = ANY($${paramIndex})`)
        params.push(options.scope.files)
        paramIndex++
      }

      if (options.scope.folders.length > 0) {
        const folderConditions = options.scope.folders.map((folder, idx) => {
          params.push(`${folder}/%`)
          return `path LIKE $${paramIndex + idx}`
        })
        conditions.push(`(${folderConditions.join(' OR ')})`)
        paramIndex += options.scope.folders.length
      }

      if (conditions.length > 0) {
        scopeCondition = `AND (${conditions.join(' OR ')})`
      }
		}
		
    const query = `
      SELECT 
        id, path, mtime, content, metadata,
        1 - (embedding <=> $1::vector) as similarity
      FROM "${tableName}"
      WHERE 1 - (embedding <=> $1::vector) > $2
      ${scopeCondition}
      ORDER BY similarity DESC
      LIMIT $3
    `

    type SearchResult = Omit<SelectVector, 'embedding'> & { similarity: number }
    const result = await this.db.query<SearchResult>(query, params)
    return result.rows
  }
}
