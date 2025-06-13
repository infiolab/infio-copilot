import { backOff } from 'exponential-backoff'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { minimatch } from 'minimatch'
import { App, Notice, TFile } from 'obsidian'
import pLimit from 'p-limit'

import { IndexProgress } from '../../../components/chat-view/QueryProgress'
import {
	LLMAPIKeyInvalidException,
	LLMAPIKeyNotSetException,
	LLMBaseUrlNotSetException,
	LLMRateLimitExceededException,
} from '../../../core/llm/exception'
import { InsertVector, SelectVector } from '../../../database/schema'
import { EmbeddingModel } from '../../../types/embedding'
import { openSettingsModalWithError } from '../../../utils/open-settings-modal'
import { DBManager } from '../../database-manager'

import { VectorRepository } from './vector-repository'

export class VectorManager {
	private app: App
	private repository: VectorRepository
	private dbManager: DBManager

	constructor(app: App, dbManager: DBManager) {
		this.app = app
		this.dbManager = dbManager
		this.repository = new VectorRepository(app, dbManager.getPgClient())
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
		return await this.repository.performSimilaritySearch(
			queryVector,
			embeddingModel,
			options,
		)
	}

	async updateVaultIndex(
		embeddingModel: EmbeddingModel,
		options: {
			chunkSize: number
			excludePatterns: string[]
			includePatterns: string[]
			reindexAll?: boolean
		},
		updateProgress?: (indexProgress: IndexProgress) => void,
	): Promise<void> {
		let filesToIndex: TFile[]
		if (options.reindexAll) {
			filesToIndex = await this.getFilesToIndex({
				embeddingModel: embeddingModel,
				excludePatterns: options.excludePatterns,
				includePatterns: options.includePatterns,
				reindexAll: true,
			})
			await this.repository.clearAllVectors(embeddingModel)
		} else {
			await this.cleanVectorsForDeletedFiles(embeddingModel)
			filesToIndex = await this.getFilesToIndex({
				embeddingModel: embeddingModel,
				excludePatterns: options.excludePatterns,
				includePatterns: options.includePatterns,
			})
			await this.repository.deleteVectorsForMultipleFiles(
				filesToIndex.map((file) => file.path),
				embeddingModel,
			)
		}

		if (filesToIndex.length === 0) {
			return
		}

		const textSplitter = RecursiveCharacterTextSplitter.fromLanguage(
			'markdown',
			{
				chunkSize: options.chunkSize,
				// TODO: Use token-based chunking after migrating to WebAssembly-based tiktoken
				// Current token counting method is too slow for practical use
				// lengthFunction: async (text) => {
				//   return await tokenCount(text)
				// },
			},
		)

		const contentChunks: InsertVector[] = (
			await Promise.all(
				filesToIndex.map(async (file) => {
					const fileContent = await this.app.vault.cachedRead(file)
					const fileDocuments = await textSplitter.createDocuments([
						fileContent,
					])
					return fileDocuments.map((chunk): InsertVector => {
						return {
							path: file.path,
							mtime: file.stat.mtime,
							content: chunk.pageContent,
							embedding: [],
							metadata: {
								startLine: Number(chunk.metadata.loc.lines.from),
								endLine: Number(chunk.metadata.loc.lines.to),
							},
						}
					})
				}),
			)
		).flat()

		updateProgress?.({
			completedChunks: 0,
			totalChunks: contentChunks.length,
			totalFiles: filesToIndex.length,
		})

		const embeddingProgress = { completed: 0 }
		const embeddingChunks: InsertVector[] = []
		const insertBatchSize = 64 // 数据库插入批量大小
		
		try {
			if (embeddingModel.supportsBatch) {
				// 支持批量处理的提供商：使用批量处理逻辑
				const embeddingBatchSize = 64 // API批量处理大小
				
				for (let i = 0; i < contentChunks.length; i += embeddingBatchSize) {
					const batchChunks = contentChunks.slice(i, Math.min(i + embeddingBatchSize, contentChunks.length))
					const batchTexts = batchChunks.map(chunk => chunk.content)
					
					await backOff(
						async () => {
							const batchEmbeddings = await embeddingModel.getBatchEmbeddings(batchTexts)
							
							// 合并embedding结果到chunk数据
							for (let j = 0; j < batchChunks.length; j++) {
								const embeddedChunk: InsertVector = {
									path: batchChunks[j].path,
									mtime: batchChunks[j].mtime,
									content: batchChunks[j].content,
									embedding: batchEmbeddings[j],
									metadata: batchChunks[j].metadata,
								}
								embeddingChunks.push(embeddedChunk)
							}
							
							embeddingProgress.completed += batchChunks.length
							updateProgress?.({
								completedChunks: embeddingProgress.completed,
								totalChunks: contentChunks.length,
								totalFiles: filesToIndex.length,
							})
						},
						{
							numOfAttempts: 5,
							startingDelay: 1000,
							timeMultiple: 1.5,
							jitter: 'full',
						},
					)
				}
			} else {
				// 不支持批量处理的提供商：使用原来的逐个处理逻辑
				const limit = pLimit(50)
				const abortController = new AbortController()
				const tasks = contentChunks.map((chunk) =>
					limit(async () => {
						if (abortController.signal.aborted) {
							throw new Error('Operation was aborted')
						}
						try {
							await backOff(
								async () => {
									const embedding = await embeddingModel.getEmbedding(chunk.content)
									const embeddedChunk = {
										path: chunk.path,
										mtime: chunk.mtime,
										content: chunk.content,
										embedding,
										metadata: chunk.metadata,
									}
									embeddingChunks.push(embeddedChunk)
									embeddingProgress.completed++
									updateProgress?.({
										completedChunks: embeddingProgress.completed,
										totalChunks: contentChunks.length,
										totalFiles: filesToIndex.length,
									})
								},
								{
									numOfAttempts: 5,
									startingDelay: 1000,
									timeMultiple: 1.5,
									jitter: 'full',
								},
							)
						} catch (error) {
							abortController.abort()
							throw error
						}
					}),
				)
				
				await Promise.all(tasks)
			}

			// all embedding generated, batch insert
			if (embeddingChunks.length > 0) {
				// batch insert all vectors
				let inserted = 0
				while (inserted < embeddingChunks.length) {
					const chunksToInsert = embeddingChunks.slice(
						inserted,
						Math.min(inserted + insertBatchSize, embeddingChunks.length)
					)
					await this.repository.insertVectors(chunksToInsert, embeddingModel)
					inserted += chunksToInsert.length
				}
			}
		} catch (error) {
			if (
				error instanceof LLMAPIKeyNotSetException ||
				error instanceof LLMAPIKeyInvalidException ||
				error instanceof LLMBaseUrlNotSetException
			) {
				openSettingsModalWithError(this.app, error.message)
			} else if (error instanceof LLMRateLimitExceededException) {
				new Notice(error.message)
			} else {
				console.error('Error embedding chunks:', error)
				throw error
			}
		}
	}

	async UpdateFileVectorIndex(
		embeddingModel: EmbeddingModel,
		chunkSize: number,
		file: TFile
	) {

		// Delete existing vectors for the files
		await this.repository.deleteVectorsForSingleFile(
			file.path,
			embeddingModel,
		)

		// Embed the files
		const textSplitter = RecursiveCharacterTextSplitter.fromLanguage(
			'markdown',
			{
				chunkSize,
			},
		)
		const fileContent = await this.app.vault.cachedRead(file)
		const fileDocuments = await textSplitter.createDocuments([
			fileContent,
		])

		const contentChunks: InsertVector[] = fileDocuments.map((chunk): InsertVector => {
			return {
				path: file.path,
				mtime: file.stat.mtime,
				content: chunk.pageContent,
				embedding: [],
				metadata: {
					startLine: Number(chunk.metadata.loc.lines.from),
					endLine: Number(chunk.metadata.loc.lines.to),
				},
			}
		})

		const embeddingChunks: InsertVector[] = []
		const insertBatchSize = 64 // 数据库插入批量大小
		
		try {
			if (embeddingModel.supportsBatch) {
				// 支持批量处理的提供商：使用批量处理逻辑
				const embeddingBatchSize = 64 // API批量处理大小
				
				for (let i = 0; i < contentChunks.length; i += embeddingBatchSize) {
					console.log(`Embedding batch ${i / embeddingBatchSize + 1} of ${Math.ceil(contentChunks.length / embeddingBatchSize)}`)
					const batchChunks = contentChunks.slice(i, Math.min(i + embeddingBatchSize, contentChunks.length))
					const batchTexts = batchChunks.map(chunk => chunk.content)
					
					await backOff(
						async () => {
							const batchEmbeddings = await embeddingModel.getBatchEmbeddings(batchTexts)
							
							// 合并embedding结果到chunk数据
							for (let j = 0; j < batchChunks.length; j++) {
								const embeddedChunk: InsertVector = {
									path: batchChunks[j].path,
									mtime: batchChunks[j].mtime,
									content: batchChunks[j].content,
									embedding: batchEmbeddings[j],
									metadata: batchChunks[j].metadata,
								}
								embeddingChunks.push(embeddedChunk)
							}
						},
						{
							numOfAttempts: 5,
							startingDelay: 1000,
							timeMultiple: 1.5,
							jitter: 'full',
						},
					)
				}
			} else {
				// 不支持批量处理的提供商：使用原来的逐个处理逻辑
				const limit = pLimit(50)
				const abortController = new AbortController()
				const tasks = contentChunks.map((chunk) =>
					limit(async () => {
						if (abortController.signal.aborted) {
							throw new Error('Operation was aborted')
						}
						try {
							await backOff(
								async () => {
									const embedding = await embeddingModel.getEmbedding(chunk.content)
									const embeddedChunk = {
										path: chunk.path,
										mtime: chunk.mtime,
										content: chunk.content,
										embedding,
										metadata: chunk.metadata,
									}
									embeddingChunks.push(embeddedChunk)
								},
								{
									numOfAttempts: 5,
									startingDelay: 1000,
									timeMultiple: 1.5,
									jitter: 'full',
								},
							)
						} catch (error) {
							abortController.abort()
							throw error
						}
					}),
				)
				
				await Promise.all(tasks)
			}

			// all embedding generated, batch insert
			if (embeddingChunks.length > 0) {
				let inserted = 0
				while (inserted < embeddingChunks.length) {
					const chunksToInsert = embeddingChunks.slice(inserted, Math.min(inserted + insertBatchSize, embeddingChunks.length))
					await this.repository.insertVectors(chunksToInsert, embeddingModel)
					inserted += chunksToInsert.length
				}
			}
		} catch (error) {
			console.error('Error embedding chunks:', error)
		}
	}

	async DeleteFileVectorIndex(
		embeddingModel: EmbeddingModel,
		file: TFile
	) {
		await this.repository.deleteVectorsForSingleFile(file.path, embeddingModel)
	}

	private async cleanVectorsForDeletedFiles(
		embeddingModel: EmbeddingModel,
	) {
		const indexedFilePaths = await this.repository.getAllIndexedFilePaths(embeddingModel)
		const needToDelete = indexedFilePaths.filter(filePath => !this.app.vault.getAbstractFileByPath(filePath))
		if (needToDelete.length > 0) {
			await this.repository.deleteVectorsForMultipleFiles(
				needToDelete,
				embeddingModel,
			)
		}
	}

	private async getFilesToIndex({
		embeddingModel,
		excludePatterns,
		includePatterns,
		reindexAll,
	}: {
		embeddingModel: EmbeddingModel
		excludePatterns: string[]
		includePatterns: string[]
		reindexAll?: boolean
	}): Promise<TFile[]> {
		let filesToIndex = this.app.vault.getMarkdownFiles()

		filesToIndex = filesToIndex.filter((file) => {
			return !excludePatterns.some((pattern) => minimatch(file.path, pattern))
		})

		if (includePatterns.length > 0) {
			filesToIndex = filesToIndex.filter((file) => {
				return includePatterns.some((pattern) => minimatch(file.path, pattern))
			})
		}

		if (reindexAll) {
			return filesToIndex
		}

		// Check for updated or new files
		filesToIndex = await Promise.all(
			filesToIndex.map(async (file) => {
				const fileChunks = await this.repository.getVectorsByFilePath(
					file.path,
					embeddingModel,
				)
				if (fileChunks.length === 0) {
					// File is not indexed, so we need to index it
					const fileContent = await this.app.vault.cachedRead(file)
					if (fileContent.length === 0) {
						// Ignore empty files
						return null
					}
					return file
				}
				const outOfDate = file.stat.mtime > fileChunks[0].mtime
				if (outOfDate) {
					// File has changed, so we need to re-index it
					return file
				}
				return null
			}),
		).then((files) => files.filter(Boolean))

		return filesToIndex
	}
}
