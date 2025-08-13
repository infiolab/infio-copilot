import { App, TFile } from 'obsidian'

import { QueryProgressState } from '../../components/chat-view/QueryProgress'
import { DBManager } from '../../database/database-manager'
import { Workspace } from '../../database/json/workspace/types'
import { VectorManager } from '../../database/modules/vector/vector-manager'
import { SelectVector } from '../../database/schema'
import { EmbeddingModel } from '../../types/embedding'
import { ApiProvider } from '../../types/llm/model'
import { InfioSettings } from '../../types/settings'
import { getFilesWithTag } from '../../utils/glob-utils'

import { getEmbeddingModel } from './embedding'

// EmbeddingManager 类型定义
type EmbeddingManager = {
	modelLoaded: boolean
	currentModel: string | null
	loadModel(modelId: string, useGpu: boolean): Promise<unknown>
	embed(text: string): Promise<{ vec: number[] }>
	embedBatch(texts: string[]): Promise<{ vec: number[] }[]>
}

export class RAGEngine {
	private app: App
	private settings: InfioSettings
	private embeddingManager?: EmbeddingManager
	private vectorManager: VectorManager | null = null
	private embeddingModel: EmbeddingModel | null = null
	private initialized = false

	constructor(
		app: App,
		settings: InfioSettings,
		dbManager: DBManager,
		embeddingManager?: EmbeddingManager,
	) {
		this.app = app
		this.settings = settings
		this.embeddingManager = embeddingManager
		this.vectorManager = dbManager.getVectorManager()
		if (settings.embeddingModelId && settings.embeddingModelId.trim() !== '') {
			try {
				this.embeddingModel = getEmbeddingModel(settings, embeddingManager)
			} catch (error) {
				console.warn('Failed to initialize embedding model:', error)
				this.embeddingModel = null
			}
		} else {
			this.embeddingModel = null
		}
	}

	cleanup() {
		this.embeddingModel = null
		this.vectorManager = null
	}

	setSettings(settings: InfioSettings) {
		this.settings = settings
		if (settings.embeddingModelId && settings.embeddingModelId.trim() !== '') {
			try {
				this.embeddingModel = getEmbeddingModel(settings, this.embeddingManager)
			} catch (error) {
				console.warn('Failed to initialize embedding model:', error)
				this.embeddingModel = null
			}
		} else {
			this.embeddingModel = null
		}
	}

	async initializeDimension(): Promise<void> {
		if (this.embeddingModel.dimension === 0 &&
			(this.settings.embeddingModelProvider === ApiProvider.Ollama || this.settings.embeddingModelProvider === ApiProvider.OpenAICompatible)) {
			this.embeddingModel.dimension = (await this.embeddingModel.getEmbedding("hello world")).length
		}
	}

	async updateVaultIndex(
		options: { reindexAll: boolean },
		onQueryProgressChange?: (queryProgress: QueryProgressState) => void,
	): Promise<void> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}
		await this.initializeDimension()

		await this.vectorManager.updateVaultIndex(
			this.embeddingModel,
			{
				chunkSize: this.settings.ragOptions.chunkSize,
				batchSize: this.settings.ragOptions.batchSize,
				excludePatterns: this.settings.ragOptions.excludePatterns,
				includePatterns: this.settings.ragOptions.includePatterns,
				reindexAll: options.reindexAll,
			},
			(indexProgress) => {
				onQueryProgressChange?.({
					type: 'indexing',
					indexProgress,
				})
			},
		)
		this.initialized = true
	}

	async updateWorkspaceIndex(
		workspace: Workspace,
		options: { reindexAll: boolean },
		onQueryProgressChange?: (queryProgress: QueryProgressState) => void,
	): Promise<void> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}
		await this.initializeDimension()

		await this.vectorManager.updateWorkspaceIndex(
			this.embeddingModel,
			workspace,
			{
				chunkSize: this.settings.ragOptions.chunkSize,
				batchSize: this.settings.ragOptions.batchSize,
				excludePatterns: this.settings.ragOptions.excludePatterns,
				includePatterns: this.settings.ragOptions.includePatterns,
				reindexAll: options.reindexAll,
			},
			(indexProgress) => {
				onQueryProgressChange?.({
					type: 'indexing',
					indexProgress,
				})
			},
		)
		this.initialized = true
	}

	async updateFileIndex(file: TFile) {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}

		await this.initializeDimension()

		await this.vectorManager.UpdateFileVectorIndex(
			this.embeddingModel,
			this.settings.ragOptions.chunkSize,
			this.settings.ragOptions.batchSize,
			file,
		)
	}

	async deleteFileIndex(file: TFile) {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}

		await this.initializeDimension()

		await this.vectorManager.DeleteFileVectorIndex(
			this.embeddingModel,
			file,
		)
	}

	async processSimilarityQuery({
		query,
		scope,
		limit,
		onQueryProgressChange,
	}: {
		query: string
		scope?: {
			files: string[]
			folders: string[]
		}
		limit?: number
		onQueryProgressChange?: (queryProgress: QueryProgressState) => void
	}): Promise<
		(Omit<SelectVector, 'embedding'> & {
			similarity: number
		})[]
	> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}

		await this.initializeDimension()

		// if (!this.initialized) {
		// 	console.log("need to updateVaultIndex")
		// 	await this.updateVaultIndex({ reindexAll: false }, onQueryProgressChange)
		// }
		const queryEmbedding = await this.getEmbedding(query)
		onQueryProgressChange?.({
			type: 'querying',
		})
		const queryResult = await this.vectorManager.performSimilaritySearch(
			queryEmbedding,
			this.embeddingModel,
			{
				minSimilarity: this.settings.ragOptions.minSimilarity,
				limit: limit ?? this.settings.ragOptions.limit,
				scope,
			},
		)
		onQueryProgressChange?.({
			type: 'querying-done',
			queryResult,
		})
		return queryResult
	}

	async processQuery({
		query,
		scope,
		limit,
		language,
		onQueryProgressChange,
		semanticSearchMethod,
	}: {
		query: string
		scope?: {
			files: string[]
			folders: string[]
		}
		limit?: number
		language?: string
		onQueryProgressChange?: (queryProgress: QueryProgressState) => void
		semanticSearchMethod?: 'hybrid' | 'vector'
	}): Promise<
		(Omit<SelectVector, 'embedding'> & {
			similarity: number
		})[]
	> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}

		await this.initializeDimension()

		onQueryProgressChange?.({
			type: 'querying',
		})

		// 根据搜索方法决定执行策略
		const searchMethod = semanticSearchMethod || 'hybrid'
		
		if (searchMethod === 'vector') {
			// 仅执行向量相似度搜索
			const similarityResults = await this.processSimilarityQuery({
				query,
				scope,
				limit,
				onQueryProgressChange: undefined, // 避免重复触发进度回调
			})
			
			onQueryProgressChange?.({
				type: 'querying-done',
				queryResult: similarityResults,
			})
			return similarityResults
		} else {
			// 并行执行相似度搜索和全文搜索 (hybrid)
			const [similarityResults, fulltextResults] = await Promise.all([
				this.processSimilarityQuery({
					query,
					scope,
					limit,
					onQueryProgressChange: undefined, // 避免重复触发进度回调
				}),
				this.processFulltextQuery({
					query,
					scope,
					limit,
					language,
					onQueryProgressChange: undefined, // 避免重复触发进度回调
				}),
			])

			// 优化：如果其中一个搜索结果为空，直接返回另一个结果
			let finalResults: (Omit<SelectVector, 'embedding'> & { similarity: number })[]

			if (fulltextResults.length === 0) {
				// 全文搜索结果为空，直接返回相似度搜索结果
				finalResults = similarityResults
			} else if (similarityResults.length === 0) {
				// 相似度搜索结果为空，直接返回全文搜索结果（转换格式）
				finalResults = fulltextResults.map(result => ({
					...result,
					similarity: 1 - (result.rank - 1) / fulltextResults.length, // 将rank转换为相似度分数
				}))
			} else {
				// 两个搜索都有结果，使用 RRF 算法合并
				const rrf_k = 60 // RRF 常数
				const mergedResults = this.mergeWithRRF(similarityResults, fulltextResults, rrf_k)

				// 转换为与现有接口兼容的格式
				finalResults = mergedResults.map(result => ({
					...result,
					similarity: result.rrfScore, // 使用 RRF 分数作为相似度
				}))
			}

			onQueryProgressChange?.({
				type: 'querying-done',
				queryResult: finalResults,
			})

			return finalResults
		}
	}

	/**
	 * 使用倒数排名融合（RRF）算法合并相似度搜索和全文搜索结果
	 * @param similarityResults 相似度搜索结果
	 * @param fulltextResults 全文搜索结果
	 * @param k RRF 常数，通常为 60
	 * @returns 合并后的结果，按 RRF 分数排序
	 */
	private mergeWithRRF(
		similarityResults: (Omit<SelectVector, 'embedding'> & { similarity: number })[],
		fulltextResults: (Omit<SelectVector, 'embedding'> & { rank: number })[],
		k: number = 60
	): (Omit<SelectVector, 'embedding'> & { rrfScore: number })[] {
		// 创建一个 Map 来存储每个文档的 RRF 分数
		const rrfScores = new Map<string, {
			doc: Omit<SelectVector, 'embedding'>,
			score: number
		}>()

		// 处理相似度搜索结果
		similarityResults.forEach((result, index) => {
			const key = `${result.path}-${result.id}`
			const rank = index + 1
			const rrfScore = 1 / (k + rank)
			
			if (rrfScores.has(key)) {
				const existing = rrfScores.get(key)
				if (existing) {
					existing.score += rrfScore
				}
			} else {
				rrfScores.set(key, {
					doc: {
						id: result.id,
						path: result.path,
						mtime: result.mtime,
						content: result.content,
						metadata: result.metadata,
					},
					score: rrfScore
				})
			}
		})

		// 处理全文搜索结果
		fulltextResults.forEach((result, index) => {
			const key = `${result.path}-${result.id}`
			const rank = index + 1
			const rrfScore = 1 / (k + rank)
			
			if (rrfScores.has(key)) {
				const existing = rrfScores.get(key)
				if (existing) {
					existing.score += rrfScore
				}
			} else {
				rrfScores.set(key, {
					doc: {
						id: result.id,
						path: result.path,
						mtime: result.mtime,
						content: result.content,
						metadata: result.metadata,
					},
					score: rrfScore
				})
			}
		})

		// 转换为数组并进行归一化处理
		const results = Array.from(rrfScores.values())
		
		// 找到最大分数用于归一化
		const maxScore = Math.max(...results.map(r => r.score))
		
		// 归一化到 0~1 范围并按分数排序
		const mergedResults = results
			.map(({ doc, score }) => ({
				...doc,
				rrfScore: maxScore > 0 ? score / maxScore : 0 // 归一化到 0~1
			}))
			.sort((a, b) => b.rrfScore - a.rrfScore)

		return mergedResults
	}

	async processFulltextQuery({
		query,
		scope,
		limit,
		language,
		onQueryProgressChange,
	}: {
		query: string
		scope?: {
			files: string[]
			folders: string[]
		}
		limit?: number
		language?: string
		onQueryProgressChange?: (queryProgress: QueryProgressState) => void
	}): Promise<
		(Omit<SelectVector, 'embedding'> & {
			rank: number
		})[]
	> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}

		await this.initializeDimension()

		onQueryProgressChange?.({
			type: 'querying',
		})

		const queryResult = await this.vectorManager.performFulltextSearch(
			query,
			this.embeddingModel,
			{
				limit: limit ?? this.settings.ragOptions.limit,
				scope,
				language: language || 'english',
			},
		)

		onQueryProgressChange?.({
			type: 'querying-done',
			queryResult: queryResult.map(result => ({
				...result,
				similarity: result.rank, // 为了兼容 QueryProgressState 类型
			})),
		})

		return queryResult
	}

	async getEmbedding(query: string): Promise<number[]> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}
		return this.embeddingModel.getEmbedding(query)
	}

	async getWorkspaceStatistics(workspace?: Workspace): Promise<{
		totalFiles: number
		totalChunks: number
	}> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}
		await this.initializeDimension()
		return await this.vectorManager.getWorkspaceStatistics(this.embeddingModel, workspace)
	}

	async getVaultStatistics(): Promise<{
		totalFiles: number
		totalChunks: number
	}> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}
		await this.initializeDimension()
		return await this.vectorManager.getVaultStatistics(this.embeddingModel)
	}

	async clearWorkspaceIndex(workspace?: Workspace): Promise<void> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}
		await this.initializeDimension()

		if (workspace) {
			// 获取工作区中的所有文件路径
			const files: string[] = []

			for (const item of workspace.content) {
				if (item.type === 'folder') {
					const folderPath = item.content
					
					// 获取文件夹下的所有文件
					const folderFiles = this.app.vault.getMarkdownFiles().filter(file => 
						file.path.startsWith(folderPath === '/' ? '' : folderPath + '/')
					)
					
					files.push(...folderFiles.map(file => file.path))
				} else if (item.type === 'tag') {
					// 获取标签对应的所有文件
					const tagFiles = getFilesWithTag(item.content, this.app)
					files.push(...tagFiles)
				}
			}

			// 删除工作区相关的向量
			if (files.length > 0) {
				// 通过 VectorManager 的私有 repository 访问
				await this.vectorManager['repository'].deleteVectorsForMultipleFiles(files, this.embeddingModel)
			}
		} else {
			// 清除所有向量
			await this.vectorManager['repository'].clearAllVectors(this.embeddingModel)
		}
	}
}
