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

	// 强制垃圾回收的辅助方法
	private forceGarbageCollection() {
		try {
			if (typeof global !== 'undefined' && global.gc) {
				global.gc()
			} else if (typeof window !== 'undefined' && (window as any).gc) {
				(window as any).gc()
			}
		} catch (e) {
			// 忽略垃圾回收错误
		}
	}

	// 检查并清理内存的辅助方法
	private async memoryCleanup(batchCount: number) {
		// 每10批次强制垃圾回收
		if (batchCount % 10 === 0) {
			this.forceGarbageCollection()
			// 短暂延迟让内存清理完成
			await new Promise(resolve => setTimeout(resolve, 100))
		}
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

		const skippedFiles: string[] = []
		const contentChunks: InsertVector[] = (
			await Promise.all(
				filesToIndex.map(async (file) => {
					try {
						let fileContent = await this.app.vault.cachedRead(file)
						// 清理null字节，防止PostgreSQL UTF8编码错误
						fileContent = fileContent.replace(/\0/g, '')
						const fileDocuments = await textSplitter.createDocuments([
							fileContent,
						])
						return fileDocuments.map((chunk): InsertVector => {
							return {
								path: file.path,
								mtime: file.stat.mtime,
								content: chunk.pageContent.replace(/\0/g, ''), // 再次清理，确保安全
								embedding: [],
								metadata: {
									startLine: Number(chunk.metadata.loc.lines.from),
									endLine: Number(chunk.metadata.loc.lines.to),
								},
							}
						})
					} catch (error) {
						console.warn(`跳过文件 ${file.path}:`, error.message)
						skippedFiles.push(file.path)
						return []
					}
				}),
			)
		).flat()

		if (skippedFiles.length > 0) {
			console.warn(`跳过了 ${skippedFiles.length} 个有问题的文件:`, skippedFiles)
			new Notice(`跳过了 ${skippedFiles.length} 个有问题的文件`)
		}

		updateProgress?.({
			completedChunks: 0,
			totalChunks: contentChunks.length,
			totalFiles: filesToIndex.length,
		})

		const embeddingProgress = { completed: 0 }
		// 减少批量大小以降低内存压力
		const insertBatchSize = 32
		let batchCount = 0
		
		try {
			if (embeddingModel.supportsBatch) {
				// 支持批量处理的提供商：使用流式处理逻辑
				const embeddingBatchSize = 32 
				
				for (let i = 0; i < contentChunks.length; i += embeddingBatchSize) {
					batchCount++
					const batchChunks = contentChunks.slice(i, Math.min(i + embeddingBatchSize, contentChunks.length))
					const batchTexts = batchChunks.map(chunk => chunk.content)
					
					const embeddedBatch: InsertVector[] = []
					
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
								embeddedBatch.push(embeddedChunk)
							}
						},
						{
							numOfAttempts: 3, // 减少重试次数
							startingDelay: 500, // 减少延迟
							timeMultiple: 1.5,
							jitter: 'full',
						},
					)

					// 立即插入当前批次，避免内存累积
					if (embeddedBatch.length > 0) {
						await this.repository.insertVectors(embeddedBatch, embeddingModel)
						// 清理批次数据
						embeddedBatch.length = 0
					}
					
					embeddingProgress.completed += batchChunks.length
					updateProgress?.({
						completedChunks: embeddingProgress.completed,
						totalChunks: contentChunks.length,
						totalFiles: filesToIndex.length,
					})

					// 定期内存清理
					await this.memoryCleanup(batchCount)
				}
			} else {
				// 不支持批量处理的提供商：使用流式处理逻辑
				const limit = pLimit(32) // 从50降低到10，减少并发压力
				const abortController = new AbortController()
				
				// 流式处理：分批处理并立即插入
				for (let i = 0; i < contentChunks.length; i += insertBatchSize) {
					if (abortController.signal.aborted) {
						throw new Error('Operation was aborted')
					}
					
					batchCount++
					const batchChunks = contentChunks.slice(i, Math.min(i + insertBatchSize, contentChunks.length))
					const embeddedBatch: InsertVector[] = []
					
					const tasks = batchChunks.map((chunk) =>
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
										embeddedBatch.push(embeddedChunk)
									},
									{
										numOfAttempts: 3, // 减少重试次数
										startingDelay: 500, // 减少延迟
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
					
					// 立即插入当前批次
					if (embeddedBatch.length > 0) {
						await this.repository.insertVectors(embeddedBatch, embeddingModel)
						// 清理批次数据
						embeddedBatch.length = 0
					}
					
					embeddingProgress.completed += batchChunks.length
					updateProgress?.({
						completedChunks: embeddingProgress.completed,
						totalChunks: contentChunks.length,
						totalFiles: filesToIndex.length,
					})

					// 定期内存清理
					await this.memoryCleanup(batchCount)
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
		} finally {
			// 最终清理
			this.forceGarbageCollection()
		}
	}

	async UpdateFileVectorIndex(
		embeddingModel: EmbeddingModel,
		chunkSize: number,
		file: TFile
	) {
		try {
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
			let fileContent = await this.app.vault.cachedRead(file)
			// 清理null字节，防止PostgreSQL UTF8编码错误
			fileContent = fileContent.replace(/\0/g, '')
			const fileDocuments = await textSplitter.createDocuments([
				fileContent,
			])

			const contentChunks: InsertVector[] = fileDocuments.map((chunk): InsertVector => {
				return {
					path: file.path,
					mtime: file.stat.mtime,
					content: chunk.pageContent.replace(/\0/g, ''), // 再次清理，确保安全
					embedding: [],
					metadata: {
						startLine: Number(chunk.metadata.loc.lines.from),
						endLine: Number(chunk.metadata.loc.lines.to),
					},
				}
			})

			// 减少批量大小以降低内存压力
			const insertBatchSize = 16 // 从64降低到16
			let batchCount = 0
			
			try {
				if (embeddingModel.supportsBatch) {
					// 支持批量处理的提供商：使用流式处理逻辑
					const embeddingBatchSize = 16 // 从64降低到16
					
					for (let i = 0; i < contentChunks.length; i += embeddingBatchSize) {
						batchCount++
						console.log(`Embedding batch ${batchCount} of ${Math.ceil(contentChunks.length / embeddingBatchSize)}`)
						const batchChunks = contentChunks.slice(i, Math.min(i + embeddingBatchSize, contentChunks.length))
						const batchTexts = batchChunks.map(chunk => chunk.content)
						
						const embeddedBatch: InsertVector[] = []
						
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
									embeddedBatch.push(embeddedChunk)
								}
							},
							{
								numOfAttempts: 3, // 减少重试次数
								startingDelay: 500, // 减少延迟
								timeMultiple: 1.5,
								jitter: 'full',
							},
						)

						// 立即插入当前批次
						if (embeddedBatch.length > 0) {
							await this.repository.insertVectors(embeddedBatch, embeddingModel)
							// 清理批次数据
							embeddedBatch.length = 0
						}

						// 定期内存清理
						await this.memoryCleanup(batchCount)
					}
				} else {
					// 不支持批量处理的提供商：使用流式处理逻辑
					const limit = pLimit(10) // 从50降低到10
					const abortController = new AbortController()
					
					// 流式处理：分批处理并立即插入
					for (let i = 0; i < contentChunks.length; i += insertBatchSize) {
						if (abortController.signal.aborted) {
							throw new Error('Operation was aborted')
						}
						
						batchCount++
						const batchChunks = contentChunks.slice(i, Math.min(i + insertBatchSize, contentChunks.length))
						const embeddedBatch: InsertVector[] = []
						
						const tasks = batchChunks.map((chunk) =>
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
											embeddedBatch.push(embeddedChunk)
										},
										{
											numOfAttempts: 3, // 减少重试次数
											startingDelay: 500, // 减少延迟
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
						
						// 立即插入当前批次
						if (embeddedBatch.length > 0) {
							await this.repository.insertVectors(embeddedBatch, embeddingModel)
							// 清理批次数据
							embeddedBatch.length = 0
						}

						// 定期内存清理
						await this.memoryCleanup(batchCount)
					}
				}
			} catch (error) {
				console.error('Error embedding chunks:', error)
			} finally {
				// 最终清理
				this.forceGarbageCollection()
			}
		} catch (error) {
			console.warn(`跳过文件 ${file.path}:`, error.message)
			new Notice(`跳过文件 ${file.name}: ${error.message}`)
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
				try {
					const fileChunks = await this.repository.getVectorsByFilePath(
						file.path,
						embeddingModel,
					)
					if (fileChunks.length === 0) {
						// File is not indexed, so we need to index it
						let fileContent = await this.app.vault.cachedRead(file)
						// 清理null字节，防止PostgreSQL UTF8编码错误
						fileContent = fileContent.replace(/\0/g, '')
						if (fileContent.length === 0) {
							// Ignore empty files
							return null
						}
						return file
					}
					const outOfDate = file.stat.mtime > fileChunks[0].mtime
					if (outOfDate) {
						// File has changed, so we need to re-index it
						console.log("File has changed, so we need to re-index it", file.path)
						return file
					}
					return null
				} catch (error) {
					console.warn(`跳过文件 ${file.path}:`, error.message)
					return null
				}
			}),
		).then((files) => files.filter(Boolean))

		return filesToIndex
	}
}
