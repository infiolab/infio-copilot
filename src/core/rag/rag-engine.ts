import { App, TFile } from 'obsidian'

import { QueryProgressState } from '../../components/chat-view/QueryProgress'
import { DBManager } from '../../database/database-manager'
import { VectorManager } from '../../database/modules/vector/vector-manager'
import { SelectVector } from '../../database/schema'
import { EmbeddingModel } from '../../types/embedding'
import { ApiProvider } from '../../types/llm/model'
import { InfioSettings } from '../../types/settings'

import { getEmbeddingModel } from './embedding'

export class RAGEngine {
	private app: App
	private settings: InfioSettings
	private vectorManager: VectorManager | null = null
	private embeddingModel: EmbeddingModel | null = null
	private initialized = false

	constructor(
		app: App,
		settings: InfioSettings,
		dbManager: DBManager,
	) {
		this.app = app
		this.settings = settings
		this.vectorManager = dbManager.getVectorManager()
		this.embeddingModel = getEmbeddingModel(settings)
	}

	cleanup() {
		this.embeddingModel = null
		this.vectorManager = null
	}

	setSettings(settings: InfioSettings) {
		this.settings = settings
		this.embeddingModel = getEmbeddingModel(settings)
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

	async processQuery({
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

	async getEmbedding(query: string): Promise<number[]> {
		if (!this.embeddingModel) {
			throw new Error('Embedding model is not set')
		}
		return this.embeddingModel.getEmbedding(query)
	}
}
