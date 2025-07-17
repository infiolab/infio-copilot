import { PGliteInterface } from '@electric-sql/pglite'
import { App } from 'obsidian'

import { EmbeddingModel } from '../../../types/embedding'
import { DatabaseNotInitializedException } from '../../exception'
import { InsertVector, SelectVector, vectorTables } from '../../schema'

export class VectorRepository {
	private app: App
	private db: PGliteInterface | null
	private stopWords: Set<string>

	constructor(app: App, pgClient: PGliteInterface | null) {
		this.app = app
		this.db = pgClient
		this.stopWords = new Set([
			// Chinese stop words
			'的', '在', '是', '了', '我', '你', '他', '她', '它', '请问', '如何', '一个', '什么', '怎么',
			'这', '那', '和', '与', '或', '但', '因为', '所以', '如果', '虽然', '可是', '不过',
			'也', '都', '还', '就', '又', '很', '最', '更', '非常', '特别', '比较', '相当',
			'对', '于', '把', '被', '让', '使', '给', '为', '从', '到', '向', '往', '朝',
			'上', '下', '里', '外', '前', '后', '左', '右', '中', '间', '内', '以', '及',

			// English stop words
			'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he',
			'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'were', 'will',
			'with', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall',
			'this', 'that', 'these', 'those', 'i', 'you', 'we', 'they', 'me', 'him', 'her',
			'us', 'them', 'my', 'your', 'his', 'our', 'their', 'am', 'have', 'had', 'do',
			'does', 'did', 'get', 'got', 'go', 'went', 'come', 'came', 'make', 'made',
			'take', 'took', 'see', 'saw', 'know', 'knew', 'think', 'thought', 'say', 'said',
			'tell', 'told', 'ask', 'asked', 'give', 'gave', 'find', 'found', 'work', 'worked',
			'call', 'called', 'try', 'tried', 'need', 'needed', 'feel', 'felt', 'become',
			'became', 'leave', 'left', 'put', 'keep', 'kept', 'let', 'begin', 'began',
			'seem', 'seemed', 'help', 'helped', 'show', 'showed', 'hear', 'heard', 'play',
			'played', 'run', 'ran', 'move', 'moved', 'live', 'lived', 'believe', 'believed',
			'hold', 'held', 'bring', 'brought', 'happen', 'happened', 'write', 'wrote',
			'sit', 'sat', 'stand', 'stood', 'lose', 'lost', 'pay', 'paid', 'meet', 'met',
			'include', 'included', 'continue', 'continued', 'set', 'learn', 'learned',
			'change', 'changed', 'lead', 'led', 'understand', 'understood', 'watch', 'watched',
			'follow', 'followed', 'stop', 'stopped', 'create', 'created', 'speak', 'spoke',
			'read', 'remember', 'remembered', 'consider', 'considered', 'appear', 'appeared',
			'buy', 'bought', 'wait', 'waited', 'serve', 'served', 'die', 'died', 'send',
			'sent', 'expect', 'expected', 'build', 'built', 'stay', 'stayed', 'fall', 'fell',
			'cut', 'reach', 'reached', 'kill', 'killed', 'remain', 'remained', 'suggest',
			'suggested', 'raise', 'raised', 'pass', 'passed', 'sell', 'sold', 'require',
			'required', 'report', 'reported', 'decide', 'decided', 'pull', 'pulled'
		])
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

	async getMaxMtime(embeddingModel: EmbeddingModel): Promise<number | null> {
		if (!this.db) {
			throw new DatabaseNotInitializedException()
		}
		const tableName = this.getTableName(embeddingModel)
		const result = await this.db.query<{ max_mtime: number | null }>(
			`SELECT MAX(mtime) as max_mtime FROM "${tableName}"`
		)
		return result.rows[0]?.max_mtime || null
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
		const params: unknown[] = [`[${queryVector.join(',')}]`, options.minSimilarity, options.limit]
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

	async performFulltextSearch(
		searchQuery: string,
		embeddingModel: EmbeddingModel,
		options: {
			limit: number
			scope?: {
				files: string[]
				folders: string[]
			}
			language?: string
		},
	): Promise<
		(Omit<SelectVector, 'embedding'> & {
			rank: number
		})[]
	> {
		if (!this.db) {
			throw new DatabaseNotInitializedException()
		}

		// handle query processing with segmentation and stop words filtering
		const processedQuery = this.createFtsQuery(searchQuery, options.language || 'english')

		const tableName = this.getTableName(embeddingModel)
		const language = options.language || 'english'

		let scopeCondition = ''
		const params: unknown[] = [processedQuery, options.limit]
		let paramIndex = 3

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
        ts_rank_cd(
          COALESCE(content_tsv, to_tsvector('${language}', coalesce(content, ''))), 
          to_tsquery('${language}', $1)
        ) AS rank
      FROM "${tableName}"
      WHERE (
        content_tsv @@ to_tsquery('${language}', $1) 
        OR (content_tsv IS NULL AND to_tsvector('${language}', coalesce(content, '')) @@ to_tsquery('${language}', $1))
      )
      ${scopeCondition}
      ORDER BY rank DESC
      LIMIT $2
    `
		type SearchResult = Omit<SelectVector, 'embedding'> & { rank: number }
		const result = await this.db.query<SearchResult>(query, params)
		return result.rows
	}

	  public segmentTextForTsvector(text: string, language: string = 'zh-CN'): string {
    try {
      // Use Intl.Segmenter to add spaces between words for better TSVECTOR indexing
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        const segmenter = new Intl.Segmenter(language, { granularity: 'word' })
        const segments = segmenter.segment(text)
        
        const segmentedText = Array.from(segments)
          .map(segment => segment.segment)
          .join(' ')
        
        return segmentedText
      }
      
      // Fallback: add spaces around Chinese characters and punctuation
      return text.replace(/([一-龯])/g, ' $1 ')
                .replace(/\s+/g, ' ')
                .trim()
    } catch (error) {
      console.warn('Failed to segment text for TSVECTOR:', error)
      return text
    }
  }

  private createFtsQuery(query: string, language: string): string {
		try {

			let keywords: string[] = []

			// Try to use Intl.Segmenter for word segmentation
			if (typeof Intl !== 'undefined' && Intl.Segmenter) {
				try {
					const segmenter = new Intl.Segmenter(language, { granularity: 'word' })
					const segments = segmenter.segment(query)

					keywords = Array.from(segments)
						.filter(s => s.isWordLike)
						.map(s => s.segment.trim())
						.filter(word => {
							// Filter out empty strings and stop words
							if (!word || word.length === 0) return false
							return !this.stopWords.has(word.toLowerCase())
						})
						.filter(word => {
							// Keep all words with length > 0 since stop words are already filtered
							return word.length > 0
						})
				} catch (segmentError) {
					console.warn('Intl.Segmenter failed, falling back to simple splitting:', segmentError)
				}
			}

			// Fallback to simple word splitting if Intl.Segmenter is not available or failed
			if (keywords.length === 0) {
				keywords = query
					.split(/[\s\p{P}\p{S}]+/u) // Split by whitespace, punctuation, and symbols
					.map(word => word.trim())
					.filter(word => {
						if (!word || word.length === 0) return false
						return !this.stopWords.has(word.toLowerCase())
					})
					.filter(word => {
						// Keep all words with length > 0 since stop words are already filtered
						return word.length > 0
					})
			}

			// If no keywords remain, return original query
			if (keywords.length === 0) {
				return query
			}

			// Join keywords with & for PostgreSQL full-text search
			const ftsQueryString = keywords.join(' | ')
			return ftsQueryString
		} catch (error) {
			// If all processing fails, return original query
			console.warn('Failed to process FTS query:', error)
			return query
		}
	}

	async getWorkspaceStatistics(
		embeddingModel: EmbeddingModel,
		scope?: {
			files: string[]
			folders: string[]
		}
	): Promise<{
		totalFiles: number
		totalChunks: number
	}> {
		if (!this.db) {
			throw new DatabaseNotInitializedException()
		}
		const tableName = this.getTableName(embeddingModel)

		let scopeCondition = ''
		const params: unknown[] = []
		let paramIndex = 1

		if (scope) {
			const conditions: string[] = []

			if (scope.files.length > 0) {
				conditions.push(`path = ANY($${paramIndex})`)
				params.push(scope.files)
				paramIndex++
			}

			if (scope.folders.length > 0) {
				const folderConditions = scope.folders.map((folder, idx) => {
					params.push(`${folder}/%`)
					return `path LIKE $${paramIndex + idx}`
				})
				conditions.push(`(${folderConditions.join(' OR ')})`)
				paramIndex += scope.folders.length
			}

			if (conditions.length > 0) {
				scopeCondition = `WHERE (${conditions.join(' OR ')})`
			}
		}

		const query = `
      SELECT 
        COUNT(DISTINCT path) as total_files,
        COUNT(*) as total_chunks
      FROM "${tableName}"
      ${scopeCondition}
    `

		const result = await this.db.query<{
			total_files: number
			total_chunks: number
		}>(query, params)

		const row = result.rows[0]
		return {
			totalFiles: Number(row?.total_files || 0),
			totalChunks: Number(row?.total_chunks || 0)
		}
	}

	async getVaultStatistics(embeddingModel: EmbeddingModel): Promise<{
		totalFiles: number
		totalChunks: number
	}> {
		if (!this.db) {
			throw new DatabaseNotInitializedException()
		}
		const tableName = this.getTableName(embeddingModel)

		const query = `
      SELECT 
        COUNT(DISTINCT path) as total_files,
        COUNT(*) as total_chunks
      FROM "${tableName}"
    `

		const result = await this.db.query<{
			total_files: number
			total_chunks: number
		}>(query)

		const row = result.rows[0]
		return {
			totalFiles: Number(row?.total_files || 0),
			totalChunks: Number(row?.total_chunks || 0)
		}
	}
}
