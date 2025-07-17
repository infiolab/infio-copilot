import { backOff } from 'exponential-backoff';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { minimatch } from 'minimatch';
import { App, Notice, TFile } from 'obsidian';
import pLimit from 'p-limit';
import removeMarkdown from 'remove-markdown';

import { IndexProgress } from '../../../components/chat-view/QueryProgress';
import {
	LLMAPIKeyInvalidException,
	LLMAPIKeyNotSetException,
	LLMBaseUrlNotSetException,
	LLMRateLimitExceededException,
} from '../../../core/llm/exception';
import { InsertVector, SelectVector } from '../../../database/schema';
import { EmbeddingModel } from '../../../types/embedding';
import { getFilesWithTag } from '../../../utils/glob-utils';
import { openSettingsModalWithError } from '../../../utils/open-settings-modal';
import { DBManager } from '../../database-manager';
import { Workspace } from '../../json/workspace/types';
import { vectorTables } from '../../schema';

import { VectorRepository } from './vector-repository';

export class VectorManager {
	private app: App
	private repository: VectorRepository
	private dbManager: DBManager

	constructor(app: App, dbManager: DBManager) {
		this.app = app
		this.dbManager = dbManager
		this.repository = new VectorRepository(app, dbManager.getPgClient() as any)
	}

	// 添加合并小chunks的辅助方法（仅在同一文件内合并）
	private mergeSmallChunks(chunks: { pageContent: string; metadata: any }[], minChunkSize: number): typeof chunks {
		if (!chunks || chunks.length === 0) {
			return []
		}

		const mergedChunks: typeof chunks = []
		let currentChunkBuffer = ""
		let currentMetadata: any = null

		for (const chunk of chunks) {
			const content = chunk.pageContent.trim()
			if (content.length === 0) continue

			// 将当前块加入缓冲区
			const combined = currentChunkBuffer ? `${currentChunkBuffer} ${content}` : content
			
			// 更新metadata，记录起始和结束位置
			const combinedMetadata = currentMetadata ? {
				...currentMetadata,
				endLine: chunk.metadata?.loc?.lines?.to || chunk.metadata?.endLine || currentMetadata.endLine
			} : {
				...chunk.metadata,
				startLine: chunk.metadata?.loc?.lines?.from || chunk.metadata?.startLine,
				endLine: chunk.metadata?.loc?.lines?.to || chunk.metadata?.endLine
			}

			if (combined.length < minChunkSize) {
				// 如果组合后仍然太小，则更新缓冲区并继续循环
				currentChunkBuffer = combined
				currentMetadata = combinedMetadata
			} else {
				// 如果组合后达到或超过最小尺寸，将其推入最终数组，并清空缓冲区
				mergedChunks.push({
					pageContent: combined,
					metadata: combinedMetadata
				})
				currentChunkBuffer = ""
				currentMetadata = null
			}
		}

		// 处理循环结束后缓冲区里可能剩下的最后一个小块
		if (currentChunkBuffer) {
			if (mergedChunks.length > 0) {
				// 策略1：如果缓冲区有内容，将其合并到最后一个块中
				const lastChunk = mergedChunks[mergedChunks.length - 1]
				lastChunk.pageContent += ` ${currentChunkBuffer}`
				lastChunk.metadata.endLine = currentMetadata?.endLine || lastChunk.metadata.endLine
			} else {
				// 策略2：或者如果就没有足够大的块，把它自己作为一个块
				mergedChunks.push({
					pageContent: currentChunkBuffer,
					metadata: currentMetadata
				})
			}
		}
		return mergedChunks
	}

	private segmentTextForTsvector(text: string): string {
		return this.repository.segmentTextForTsvector(text)
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
		return await this.repository.performFulltextSearch(
			searchQuery,
			embeddingModel,
			options,
		)
	}

	async getWorkspaceStatistics(
		embeddingModel: EmbeddingModel,
		workspace?: Workspace
	): Promise<{
		totalFiles: number
		totalChunks: number
	}> {
		// 构建工作区范围
		let scope: { files: string[], folders: string[] } | undefined
		if (workspace) {
			const folders: string[] = []
			const files: string[] = []

			// 处理工作区中的文件夹和标签
			for (const item of workspace.content) {
				if (item.type === 'folder') {
					folders.push(item.content)
				} else if (item.type === 'tag') {
					// 获取标签对应的所有文件
					const tagFiles = getFilesWithTag(item.content, this.app)
					files.push(...tagFiles)
				}
			}

			// 只有当有文件夹或文件时才设置 scope
			if (folders.length > 0 || files.length > 0) {
				scope = { files, folders }
			}
		}

		if (scope) {
			return await this.repository.getWorkspaceStatistics(embeddingModel, scope)
		} else {
			return await this.repository.getVaultStatistics(embeddingModel)
		}
	}

	async getVaultStatistics(embeddingModel: EmbeddingModel): Promise<{
		totalFiles: number
		totalChunks: number
	}> {
		return await this.repository.getVaultStatistics(embeddingModel)
	}

	// 强制垃圾回收的辅助方法
	private forceGarbageCollection() {
		try {
			// 强制垃圾回收多次，确保释放资源
			for (let i = 0; i < 3; i++) {
				if (typeof global !== 'undefined' && (global as any).gc) {
					(global as any).gc()
				} else if (typeof window !== 'undefined' && (window as any).gc) {
					(window as any).gc()
				}
			}
			
			// 强制清理一些可能的引用
			if (typeof global !== 'undefined' && (global as any).gc) {
				// Node.js 环境
				setTimeout(() => {
					(global as any).gc?.()
				}, 0)
			}
		} catch (e) {
			// 忽略垃圾回收错误
			console.debug('GC error (ignored):', e)
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
			batchSize: number
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

		// Embed the files
		const overlap = Math.floor(options.chunkSize * 0.15)
		const textSplitter = new RecursiveCharacterTextSplitter({
			chunkSize: options.chunkSize,
			chunkOverlap: overlap,
			separators: [
				"\n\n",
				"\n",
				".",
				",",
				" ",
				"\u200b",  // Zero-width space
				"\uff0c",  // Fullwidth comma
				"\u3001",  // Ideographic comma
				"\uff0e",  // Fullwidth full stop
				"\u3002",  // Ideographic full stop
				"",
			],
		});
		
		// 设置最小chunk大小，防止产生太小的chunks
		const minChunkSize = Math.max(100, Math.floor(options.chunkSize * 0.3)); // 最小50字符或chunk_size的50%

		const skippedFiles: string[] = []
		const embeddingProgress = { completed: 0, totalChunks: 0 }
		
		// 分批处理文件，每批最多50个文件（减少以避免文件句柄耗尽）
		const FILE_BATCH_SIZE = 50
		// 减少批量大小以降低内存压力
		const embeddingBatchSize = options.batchSize
		
		// 首先统计总的分块数量用于进度显示
		let totalChunks = 0
		for (let i = 0; i < filesToIndex.length; i += FILE_BATCH_SIZE) {
			const fileBatch = filesToIndex.slice(i, Math.min(i + FILE_BATCH_SIZE, filesToIndex.length))
			for (const file of fileBatch) {
				try {
					let fileContent = await this.app.vault.cachedRead(file)
					fileContent = fileContent.replace(/\0/g, '')
					const fileDocuments = await textSplitter.createDocuments([fileContent])
					// 统计阶段也需要使用相同的清理和合并逻辑
					const cleanedChunks = fileDocuments.map(chunk => ({
						pageContent: removeMarkdown(chunk.pageContent).replace(/\0/g, '').trim(),
						metadata: chunk.metadata
					})).filter(chunk => chunk.pageContent.length > 0)
					const filteredDocuments = this.mergeSmallChunks(cleanedChunks, minChunkSize)
					totalChunks += filteredDocuments.length
				} catch (error) {
					// 统计阶段跳过错误文件
				}
			}
		}
		
		embeddingProgress.totalChunks = totalChunks
		updateProgress?.({
			completedChunks: 0,
			totalChunks: totalChunks,
			totalFiles: filesToIndex.length,
		})

		try {
			for (let i = 0; i < filesToIndex.length; i += FILE_BATCH_SIZE) {
				const fileBatch = filesToIndex.slice(i, Math.min(i + FILE_BATCH_SIZE, filesToIndex.length))
				
				// 第一步：分块处理
				const batchChunks = (
					await Promise.all(
						fileBatch.map(async (file) => {
							try {
								let fileContent = await this.app.vault.cachedRead(file)
								// 清理null字节，防止PostgreSQL UTF8编码错误
								fileContent = fileContent.replace(/\0/g, '')
								const fileDocuments = await textSplitter.createDocuments([
									fileContent,
								])
								
								// 先清理每个chunk的内容，然后基于清理后的内容进行合并
								const cleanedChunks = fileDocuments.map(chunk => ({
									pageContent: removeMarkdown(chunk.pageContent).replace(/\0/g, '').trim(),
									metadata: chunk.metadata
								})).filter(chunk => chunk.pageContent.length > 0)
								
								const filteredDocuments = this.mergeSmallChunks(cleanedChunks, minChunkSize)
								return filteredDocuments
									.map((chunk): InsertVector | null => {
										const cleanContent = chunk.pageContent
										if (!cleanContent || cleanContent.trim().length === 0) {
											return null
										}
										// Use Intl.Segmenter to add spaces for better TSVECTOR indexing
										const segmentedContent = this.segmentTextForTsvector(cleanContent)
										return {
											path: file.path,
											mtime: file.stat.mtime,
											content: segmentedContent, // 使用分词后的内容
											embedding: [],
											metadata: {
												startLine: Number(chunk.metadata.loc?.lines?.from || chunk.metadata.startLine),
												endLine: Number(chunk.metadata.loc?.lines?.to || chunk.metadata.endLine),
											},
										}
									})
									.filter((chunk): chunk is InsertVector => chunk !== null)
							} catch (error) {
								console.warn(`跳过文件 ${file.path}:`, error.message)
								skippedFiles.push(file.path)
								return []
							}
						}),
					)
				).flat()
				
				if (batchChunks.length === 0) {
					continue
				}
				
				// 第二步：嵌入处理
				if (embeddingModel.supportsBatch) {
					// 支持批量处理的提供商
					for (let j = 0; j < batchChunks.length; j += embeddingBatchSize) {
						const embeddingBatch = batchChunks.slice(j, Math.min(j + embeddingBatchSize, batchChunks.length))
						const embeddedBatch: InsertVector[] = []

						await backOff(
							async () => {
								// 内容已经在前面清理和合并过了，直接使用
								const validBatchData = embeddingBatch.filter(chunk => 
									chunk.content && chunk.content.trim().length > 0
								)

								if (validBatchData.length === 0) {
									return
								}

								const batchTexts = validBatchData.map(chunk => chunk.content)
								const batchEmbeddings = await embeddingModel.getBatchEmbeddings(batchTexts)

								// 合并embedding结果到chunk数据
								for (let k = 0; k < validBatchData.length; k++) {
									const chunk = validBatchData[k]
									const embeddedChunk: InsertVector = {
										path: chunk.path,
										mtime: chunk.mtime,
										content: chunk.content, // 使用已经清理和合并后的内容
										embedding: batchEmbeddings[k],
										metadata: chunk.metadata,
									}
									embeddedBatch.push(embeddedChunk)
								}
							},
							{
								numOfAttempts: 3,
								startingDelay: 500,
								timeMultiple: 1.5,
								jitter: 'full',
							},
						)

						// 第三步：立即存储
						if (embeddedBatch.length > 0) {
							await this.insertVectorsWithTransaction(embeddedBatch, embeddingModel)
						}

						embeddingProgress.completed += embeddingBatch.length
						updateProgress?.({
							completedChunks: embeddingProgress.completed,
							totalChunks: embeddingProgress.totalChunks,
							totalFiles: filesToIndex.length,
						})
					}
				} else {
					// 不支持批量处理的提供商（减少并发度以避免文件句柄耗尽）
					const limit = pLimit(3)
					
					for (let j = 0; j < batchChunks.length; j += embeddingBatchSize) {
						const embeddingBatch = batchChunks.slice(j, Math.min(j + embeddingBatchSize, batchChunks.length))
						const embeddedBatch: InsertVector[] = []

						const tasks = embeddingBatch.map((chunk) =>
							limit(async () => {
								try {
									await backOff(
										async () => {
											// 内容已经在前面清理和合并过了，直接使用
											const content = chunk.content.trim()
											// 跳过空内容
											if (!content || content.length === 0) {
												return
											}

											const embedding = await embeddingModel.getEmbedding(content)
											const embeddedChunk = {
												path: chunk.path,
												mtime: chunk.mtime,
												content: content, // 使用已经清理和合并后的内容
												embedding,
												metadata: chunk.metadata,
											}
											embeddedBatch.push(embeddedChunk)
										},
										{
											numOfAttempts: 3,
											startingDelay: 1000,
											timeMultiple: 2.0,
											jitter: 'full',
										},
									)
								} catch (error) {
									console.error('Error in embedding task:', error)
								}
							}),
						)

						await Promise.all(tasks)

						// 第三步：立即存储
						if (embeddedBatch.length > 0) {
							await this.insertVectorsWithTransaction(embeddedBatch, embeddingModel)
						}

						embeddingProgress.completed += embeddingBatch.length
						updateProgress?.({
							completedChunks: embeddingProgress.completed,
							totalChunks: embeddingProgress.totalChunks,
							totalFiles: filesToIndex.length,
						})
					}
				}
				
				// 每批文件处理完后进行强制资源清理
				await this.forceResourceCleanup()
				
				// 额外延迟以允许系统释放文件句柄
				await new Promise(resolve => setTimeout(resolve, 500))
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
			// 最终强制清理
			await this.forceResourceCleanup()
		}

		if (skippedFiles.length > 0) {
			console.warn(`跳过了 ${skippedFiles.length} 个有问题的文件:`, skippedFiles)
			new Notice(`跳过了 ${skippedFiles.length} 个有问题的文件`)
		}
	}

	async updateWorkspaceIndex(
		embeddingModel: EmbeddingModel,
		workspace: Workspace,
		options: {
			chunkSize: number
			batchSize: number
			excludePatterns: string[]
			includePatterns: string[]
			reindexAll?: boolean
		},
		updateProgress?: (indexProgress: IndexProgress) => void,
	): Promise<void> {
		let filesToIndex: TFile[]
		if (options.reindexAll) {
			filesToIndex = await this.getFilesToIndexInWorkspace({
				embeddingModel: embeddingModel,
				workspace: workspace,
				excludePatterns: options.excludePatterns,
				includePatterns: options.includePatterns,
				reindexAll: true,
			})
			// 只清理工作区相关的向量，而不是全部
			const workspaceFilePaths = filesToIndex.map((file) => file.path)
			if (workspaceFilePaths.length > 0) {
				await this.repository.deleteVectorsForMultipleFiles(workspaceFilePaths, embeddingModel)
			}
		} else {
			await this.cleanVectorsForDeletedFiles(embeddingModel)
			filesToIndex = await this.getFilesToIndexInWorkspace({
				embeddingModel: embeddingModel,
				workspace: workspace,
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

		// Embed the files (使用与 updateVaultIndex 相同的逻辑)
		const overlap = Math.floor(options.chunkSize * 0.15)
		const textSplitter = new RecursiveCharacterTextSplitter({
			chunkSize: options.chunkSize,
			chunkOverlap: overlap,
			separators: [
				"\n\n",
				"\n",
				".",
				",",
				" ",
				"\u200b",  // Zero-width space
				"\uff0c",  // Fullwidth comma
				"\u3001",  // Ideographic comma
				"\uff0e",  // Fullwidth full stop
				"\u3002",  // Ideographic full stop
				"",
			],
		});
		
		// 设置最小chunk大小，防止产生太小的chunks
		const minChunkSize = Math.max(100, Math.floor(options.chunkSize * 0.5)); // 最小50字符或chunk_size的10%

		const skippedFiles: string[] = []
		const embeddingProgress = { completed: 0, totalChunks: 0 }
		
		// 分批处理文件，每批最多50个文件（减少以避免文件句柄耗尽）
		const FILE_BATCH_SIZE = 50
		// 减少批量大小以降低内存压力
		const embeddingBatchSize = options.batchSize
		
		// 首先统计总的分块数量用于进度显示
		let totalChunks = 0
		for (let i = 0; i < filesToIndex.length; i += FILE_BATCH_SIZE) {
			const fileBatch = filesToIndex.slice(i, Math.min(i + FILE_BATCH_SIZE, filesToIndex.length))
			for (const file of fileBatch) {
				try {
					let fileContent = await this.app.vault.cachedRead(file)
					fileContent = fileContent.replace(/\0/g, '')
					const fileDocuments = await textSplitter.createDocuments([fileContent])
					// 统计阶段也需要使用相同的清理和合并逻辑
					const cleanedChunks = fileDocuments.map(chunk => ({
						pageContent: removeMarkdown(chunk.pageContent).replace(/\0/g, '').trim(),
						metadata: chunk.metadata
					})).filter(chunk => chunk.pageContent.length > 0)
					const filteredDocuments = this.mergeSmallChunks(cleanedChunks, minChunkSize)
					totalChunks += filteredDocuments.length
				} catch (error) {
					// 统计阶段跳过错误文件
				}
			}
		}
		
		embeddingProgress.totalChunks = totalChunks
		updateProgress?.({
			completedChunks: 0,
			totalChunks: totalChunks,
			totalFiles: filesToIndex.length,
		})

		try {
			for (let i = 0; i < filesToIndex.length; i += FILE_BATCH_SIZE) {
				const fileBatch = filesToIndex.slice(i, Math.min(i + FILE_BATCH_SIZE, filesToIndex.length))
				
				// 第一步：分块处理
				const batchChunks = (
					await Promise.all(
						fileBatch.map(async (file) => {
							try {
								let fileContent = await this.app.vault.cachedRead(file)
								// 清理null字节，防止PostgreSQL UTF8编码错误
								fileContent = fileContent.replace(/\0/g, '')
								const fileDocuments = await textSplitter.createDocuments([
									fileContent,
								])
								
								// 先清理每个chunk的内容，然后基于清理后的内容进行合并
								const cleanedChunks = fileDocuments.map(chunk => ({
									pageContent: removeMarkdown(chunk.pageContent).replace(/\0/g, '').trim(),
									metadata: chunk.metadata
								})).filter(chunk => chunk.pageContent.length > 0)
								
								const filteredDocuments = this.mergeSmallChunks(cleanedChunks, minChunkSize)
								return filteredDocuments
									.map((chunk): InsertVector | null => {
										const cleanContent = chunk.pageContent
										if (!cleanContent || cleanContent.trim().length === 0) {
											return null
										}
										// Use Intl.Segmenter to add spaces for better TSVECTOR indexing
										const segmentedContent = this.segmentTextForTsvector(cleanContent)
										return {
											path: file.path,
											mtime: file.stat.mtime,
											content: segmentedContent, // 使用分词后的内容
											embedding: [],
											metadata: {
												startLine: Number(chunk.metadata.loc?.lines?.from || chunk.metadata.startLine),
												endLine: Number(chunk.metadata.loc?.lines?.to || chunk.metadata.endLine),
											},
										}
									})
									.filter((chunk): chunk is InsertVector => chunk !== null)
							} catch (error) {
								console.warn(`跳过文件 ${file.path}:`, error.message)
								skippedFiles.push(file.path)
								return []
							}
						}),
					)
				).flat()
				
				if (batchChunks.length === 0) {
					continue
				}
				
				// 第二步：嵌入处理				
				if (embeddingModel.supportsBatch) {
					// 支持批量处理的提供商
					for (let j = 0; j < batchChunks.length; j += embeddingBatchSize) {
						const embeddingBatch = batchChunks.slice(j, Math.min(j + embeddingBatchSize, batchChunks.length))
						const embeddedBatch: InsertVector[] = []

						await backOff(
							async () => {
								// 内容已经在前面清理和合并过了，直接使用
								const validBatchData = embeddingBatch.filter(chunk => 
									chunk.content && chunk.content.trim().length > 0
								)

								if (validBatchData.length === 0) {
									return
								}

								const batchTexts = validBatchData.map(chunk => chunk.content)
								const batchEmbeddings = await embeddingModel.getBatchEmbeddings(batchTexts)

								// 合并embedding结果到chunk数据
								for (let k = 0; k < validBatchData.length; k++) {
									const chunk = validBatchData[k]
									const embeddedChunk: InsertVector = {
										path: chunk.path,
										mtime: chunk.mtime,
										content: chunk.content, // 使用已经清理和合并后的内容
										embedding: batchEmbeddings[k],
										metadata: chunk.metadata,
									}
									embeddedBatch.push(embeddedChunk)
								}
							},
							{
								numOfAttempts: 3,
								startingDelay: 1000,
								timeMultiple: 2.0,
								jitter: 'full',
							},
						)

						// 第三步：立即存储
						if (embeddedBatch.length > 0) {
							await this.insertVectorsWithTransaction(embeddedBatch, embeddingModel)
						}

						embeddingProgress.completed += embeddingBatch.length
						updateProgress?.({
							completedChunks: embeddingProgress.completed,
							totalChunks: embeddingProgress.totalChunks,
							totalFiles: filesToIndex.length,
						})
					}
				} else {
					// 不支持批量处理的提供商（减少并发度以避免文件句柄耗尽）
					const limit = pLimit(3)
					
					for (let j = 0; j < batchChunks.length; j += embeddingBatchSize) {
						const embeddingBatch = batchChunks.slice(j, Math.min(j + embeddingBatchSize, batchChunks.length))
						const embeddedBatch: InsertVector[] = []

						const tasks = embeddingBatch.map((chunk) =>
							limit(async () => {
								try {
									await backOff(
										async () => {
											// 内容已经在前面清理和合并过了，直接使用
											const content = chunk.content.trim()
											// 跳过空内容
											if (!content || content.length === 0) {
												return
											}

											const embedding = await embeddingModel.getEmbedding(content)
											const embeddedChunk = {
												path: chunk.path,
												mtime: chunk.mtime,
												content: content, // 使用已经清理和合并后的内容
												embedding,
												metadata: chunk.metadata,
											}
											embeddedBatch.push(embeddedChunk)
										},
										{
											numOfAttempts: 3,
											startingDelay: 1000,
											timeMultiple: 2.0,
											jitter: 'full',
										},
									)
								} catch (error) {
									console.error('Error in embedding task:', error)
								}
							}),
						)

						await Promise.all(tasks)

						// 第三步：立即存储
						if (embeddedBatch.length > 0) {
							await this.insertVectorsWithTransaction(embeddedBatch, embeddingModel)
						}

						embeddingProgress.completed += embeddingBatch.length
						updateProgress?.({
							completedChunks: embeddingProgress.completed,
							totalChunks: embeddingProgress.totalChunks,
							totalFiles: filesToIndex.length,
						})
					}
				}
				
				// 每批文件处理完后进行强制资源清理
				await this.forceResourceCleanup()
				
				// 额外延迟以允许系统释放文件句柄
				await new Promise(resolve => setTimeout(resolve, 500))
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
			// 最终强制清理
			await this.forceResourceCleanup()
		}

		if (skippedFiles.length > 0) {
			console.warn(`跳过了 ${skippedFiles.length} 个有问题的文件:`, skippedFiles)
			new Notice(`跳过了 ${skippedFiles.length} 个有问题的文件`)
		}
	}

	async UpdateFileVectorIndex(
		embeddingModel: EmbeddingModel,
		chunkSize: number,
		batchSize: number,
		file: TFile
	) {
		try {
			// Delete existing vectors for the files
			await this.repository.deleteVectorsForSingleFile(
				file.path,
				embeddingModel,
			)

			// Embed the files
			const overlap = Math.floor(chunkSize * 0.15)
			const textSplitter = new RecursiveCharacterTextSplitter({
				chunkSize: chunkSize,
				chunkOverlap: overlap,
				separators: [
					"\n\n",
					"\n",
					".",
					",",
					" ",
					"\u200b",  // Zero-width space
					"\uff0c",  // Fullwidth comma
					"\u3001",  // Ideographic comma
					"\uff0e",  // Fullwidth full stop
					"\u3002",  // Ideographic full stop
					"",
				],
			});
			
			// 设置最小chunk大小，防止产生太小的chunks
			const minChunkSize = Math.max(50, Math.floor(chunkSize * 0.1)); // 最小50字符或chunk_size的10%
			
			let fileContent = await this.app.vault.cachedRead(file)
			// 清理null字节，防止PostgreSQL UTF8编码错误
			fileContent = fileContent.replace(/\0/g, '')
			const fileDocuments = await textSplitter.createDocuments([
				fileContent,
			])
			
			// 先清理每个chunk的内容，然后基于清理后的内容进行合并
			const cleanedChunks = fileDocuments.map(chunk => ({
				pageContent: removeMarkdown(chunk.pageContent).replace(/\0/g, '').trim(),
				metadata: chunk.metadata
			})).filter(chunk => chunk.pageContent.length > 0)
			
			const filteredDocuments = this.mergeSmallChunks(cleanedChunks, minChunkSize)

			const contentChunks: InsertVector[] = filteredDocuments
				.map((chunk): InsertVector | null => {
					const cleanContent = chunk.pageContent
					if (!cleanContent || cleanContent.trim().length === 0) {
						return null
					}
					// Use Intl.Segmenter to add spaces for better TSVECTOR indexing
					const segmentedContent = this.segmentTextForTsvector(cleanContent)
					return {
						path: file.path,
						mtime: file.stat.mtime,
						content: segmentedContent, // 使用分词后的内容
						embedding: [],
						metadata: {
							startLine: Number(chunk.metadata.loc?.lines?.from || chunk.metadata.startLine),
							endLine: Number(chunk.metadata.loc?.lines?.to || chunk.metadata.endLine),
						},
					}
				})
				.filter((chunk): chunk is InsertVector => chunk !== null)

			let batchCount = 0

			try {
				if (embeddingModel.supportsBatch) {
					// 支持批量处理的提供商：使用流式处理逻辑
					for (let i = 0; i < contentChunks.length; i += batchSize) {
						batchCount++
						const batchChunks = contentChunks.slice(i, Math.min(i + batchSize, contentChunks.length))

						const embeddedBatch: InsertVector[] = []

													await backOff(
								async () => {
									// 内容已经在前面清理和合并过了，直接使用
									const validBatchData = batchChunks.filter(chunk => 
										chunk.content && chunk.content.trim().length > 0
									)

									if (validBatchData.length === 0) {
										return
									}

									const batchTexts = validBatchData.map(chunk => chunk.content)
									const batchEmbeddings = await embeddingModel.getBatchEmbeddings(batchTexts)

									// 合并embedding结果到chunk数据
									for (let j = 0; j < validBatchData.length; j++) {
										const chunk = validBatchData[j]
										const embeddedChunk: InsertVector = {
											path: chunk.path,
											mtime: chunk.mtime,
											content: chunk.content, // 使用已经清理和合并后的内容
											embedding: batchEmbeddings[j],
											metadata: chunk.metadata,
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
					for (let i = 0; i < contentChunks.length; i += batchSize) {
						if (abortController.signal.aborted) {
							throw new Error('Operation was aborted')
						}

						batchCount++
						const batchChunks = contentChunks.slice(i, Math.min(i + batchSize, contentChunks.length))
						const embeddedBatch: InsertVector[] = []

						const tasks = batchChunks.map((chunk) =>
							limit(async () => {
								if (abortController.signal.aborted) {
									throw new Error('Operation was aborted')
								}
								try {
									await backOff(
										async () => {
											// 内容已经在前面清理和合并过了，直接使用
											const content = chunk.content.trim()
											// 跳过空内容
											if (!content || content.length === 0) {
												return
											}

											const embedding = await embeddingModel.getEmbedding(content)
											const embeddedChunk = {
												path: chunk.path,
												mtime: chunk.mtime,
												content: content, // 使用已经清理和合并后的内容
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

		// 优化流程：使用数据库最大mtime来过滤需要更新的文件
		try {
			const maxMtime = await this.repository.getMaxMtime(embeddingModel)

			if (maxMtime === null) {
				// 数据库中没有任何向量，需要索引所有文件
				return filesToIndex
			}

			// 筛选出在数据库最后更新时间之后修改的文件
			return filesToIndex.filter((file) => {
				return file.stat.mtime > maxMtime
			})
		} catch (error) {
			console.error("Error getting max mtime from database:", error)
			return []
		}
	}

	private async getFilesToIndexInWorkspace({
		embeddingModel,
		workspace,
		excludePatterns,
		includePatterns,
		reindexAll,
	}: {
		embeddingModel: EmbeddingModel
		workspace: Workspace
		excludePatterns: string[]
		includePatterns: string[]
		reindexAll?: boolean
	}): Promise<TFile[]> {
		// 获取工作区中的所有文件
		const workspaceFiles = new Set<string>()

		if (workspace) {
			// 处理工作区中的文件夹和标签
			for (const item of workspace.content) {
				if (item.type === 'folder') {
					const folderPath = item.content
					
					// 获取文件夹下的所有文件
					const files = this.app.vault.getMarkdownFiles().filter(file => 
						file.path.startsWith(folderPath === '/' ? '' : folderPath + '/')
					)
					
					// 添加所有文件路径
					files.forEach(file => {
						workspaceFiles.add(file.path)
					})

				} else if (item.type === 'tag') {
					// 获取标签对应的所有文件
					const tagFiles = getFilesWithTag(item.content, this.app)
					
					tagFiles.forEach(filePath => {
						workspaceFiles.add(filePath)
					})
				}
			}
		}

		// 将路径转换为 TFile 对象
		let filesToIndex = Array.from(workspaceFiles)
			.map(path => this.app.vault.getFileByPath(path))
			.filter((file): file is TFile => file !== null && file instanceof TFile)

		// 应用排除和包含模式
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

		// 优化流程：使用数据库最大mtime来过滤需要更新的文件
		try {
			const maxMtime = await this.repository.getMaxMtime(embeddingModel)
			if (maxMtime === null) {
				// 数据库中没有任何向量，需要索引所有文件
				return filesToIndex
			}

			// 筛选出在数据库最后更新时间之后修改的文件
			return filesToIndex.filter((file) => {
				return file.stat.mtime > maxMtime
			})
		} catch (error) {
			console.error("Error getting max mtime from database:", error)
			return []
		}
	}

	// 增强的内存清理方法，增加延迟
	private async memoryCleanupWithDelay(batchCount: number) {
		// 每3批次强制垃圾回收和延迟
		if (batchCount % 3 === 0) {
			this.forceGarbageCollection()
			// 增加延迟让系统有时间处理和释放文件句柄
			await new Promise(resolve => setTimeout(resolve, 1000))
		}
	}

	// 强制内存和资源清理
	private async forceResourceCleanup() {
		// 多次垃圾回收
		for (let i = 0; i < 5; i++) {
			this.forceGarbageCollection()
			await new Promise(resolve => setTimeout(resolve, 100))
		}
		
		// 额外延迟让系统释放资源
		await new Promise(resolve => setTimeout(resolve, 500))
	}

	// 使用事务插入向量的方法
	private async insertVectorsWithTransaction(
		data: InsertVector[],
		embeddingModel: EmbeddingModel,
	): Promise<void> {
		const db = this.dbManager.getPgClient()
		if (!db) {
			throw new Error('Database not initialized')
		}

		const tableName = this.getTableName(embeddingModel)

		// 使用 .exec 方法进行批量插入，性能更好
		const insertStatements = data.map((vector) => {
			// 转义字符串值以防止SQL注入
			const escapedPath = vector.path.replace(/'/g, "''")
			const escapedContent = vector.content.replace(/\0/g, '').replace(/'/g, "''")
			const embeddingVector = `[${vector.embedding.join(',')}]`
			const escapedMetadata = JSON.stringify(vector.metadata).replace(/'/g, "''")
			
			return `INSERT INTO "${tableName}" (path, mtime, content, embedding, metadata) VALUES ('${escapedPath}', ${vector.mtime}, '${escapedContent}', '${embeddingVector}', '${escapedMetadata}');`
		}).join('\n')

		// 使用事务包装批量插入
		const sql = `
			BEGIN;
			${insertStatements}
			COMMIT;
		`

		await db.exec(sql)
	}

	// 获取表名的辅助方法
	private getTableName(embeddingModel: EmbeddingModel): string {
		const tableDefinition = vectorTables[embeddingModel.dimension]
		if (!tableDefinition) {
			throw new Error(`No table definition found for model: ${embeddingModel.id}`)
		}
		return tableDefinition.name
	}
}
