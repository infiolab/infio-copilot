import { minimatch } from 'minimatch'
import { App, TFile, TFolder, Vault } from 'obsidian'

import { RAGEngine } from '../core/rag/rag-engine'
import { TRANSFORMATIONS, TransEngine } from '../core/transformations/trans-engine'
import { Workspace } from '../database/json/workspace/types'
import { SelectSourceInsight, SelectVector } from '../database/schema'

import { normalizePath } from './path'
import { addLineNumbers } from './prompt-generator'

// Type definitions for search results
interface RAGSearchResult extends Omit<SelectVector, 'embedding'> {
	similarity: number
}

interface InsightSearchResult extends Omit<SelectSourceInsight, 'embedding'> {
	similarity: number
}

export const findFilesMatchingPatterns = async (
	patterns: string[],
	vault: Vault,
) => {
	const files = vault.getMarkdownFiles()
	return files.filter((file) => {
		return patterns.some((pattern) => minimatch(file.path, pattern))
	})
}

/**
 * 根据标签查找文件
 */

export const getFilesWithTag = (targetTag: string, app: App): string[] => {
	// 确保输入的标签以 '#' 开头
	if (!targetTag.startsWith('#')) {
		targetTag = '#' + targetTag;
	}

	const filesWithTag: string[] = []; // 文件路径列表

	// 1. 获取 Vault 中所有的 Markdown 文件
	const allFiles = app.vault.getMarkdownFiles();

	// 2. 遍历所有文件
	for (const file of allFiles) {
		// 3. 获取当前文件的元数据缓存
		// 这个操作非常快，因为它读取的是内存中的缓存
		const cache = app.metadataCache.getFileCache(file);

		// 检查缓存是否存在，以及缓存中是否有 tags 属性
		if (cache?.tags) {
			// 4. 在文件的标签数组中查找目标标签
			// cache.tags 是一个 TagCache[] 数组，每个对象的格式为 { tag: string; position: Pos; }
			const found = cache.tags.find(tagObj => tagObj.tag === targetTag);
			if (found) {
				filesWithTag.push(file.path);
			}
		}
	}

	return filesWithTag;
}

/**
 * 列出工作区的文件和文件夹
 */
export const listFilesAndFolders = async (
	vault: Vault,
	path?: string,
	recursive = false,
	workspace?: Workspace,
	app?: App
): Promise<string[]> => {
	const result: string[] = []

	// 如果有工作区，使用工作区内容
	if (workspace && app) {
		result.push(`[Workspace: ${workspace.name}]`)
		result.push('')

		// 按类型分组处理工作区内容
		const folders = workspace.content.filter(c => c.type === 'folder')
		const tags = workspace.content.filter(c => c.type === 'tag')

		// 处理文件夹
		if (folders.length > 0) {
			result.push('=== FOLDERS ===')
			for (const folderItem of folders) {
				const folder = vault.getAbstractFileByPath(folderItem.content)
				if (folder && folder instanceof TFolder) {
					result.push(`├── ${folder.path}/`)

					if (recursive) {
						// 递归显示文件夹内容
						const subContent = await listFolderContentsRecursively(folder, '│   ')
						result.push(...subContent)
					} else {
						// 只显示第一层内容
						const subContent = await listFolderContentsFirstLevel(folder, '│   ')
						result.push(...subContent)
					}
				}
			}

			// 如果还有标签，添加空行分隔
			if (tags.length > 0) {
				result.push('')
			}
		}

		// 处理标签（使用平铺格式，不使用树状结构）
		if (tags.length > 0) {
			result.push('=== TAGS ===')
			for (const tagItem of tags) {
				const files = getFilesWithTag(tagItem.content, app)
				if (files.length > 0) {
					result.push(`${tagItem.content} (${files.length} files):`)

					// 使用简单的列表格式显示文件
					files.forEach((file) => {
						result.push(`${file}`)
					})

					// 在标签组之间添加空行
					result.push('')
				} else {
					result.push(`${tagItem.content} (0 files)`)
					result.push('')
				}
			}
		}

		return result
	}

	// 原有的单个路径逻辑（保持向后兼容）
	const startPath = path && path !== '' && path !== '.' && path !== '/' ? path : ''
	const folder = startPath ? vault.getAbstractFileByPath(startPath) : vault.getRoot()

	if (!folder || !(folder instanceof TFolder)) {
		return []
	}

	const listFolderContents = (currentFolder: TFolder, prefix = '') => {
		const children = [...currentFolder.children].sort((a, b) => {
			if (a instanceof TFolder && b instanceof TFile) return -1
			if (a instanceof TFile && b instanceof TFolder) return 1
			return a.name.localeCompare(b.name)
		})

		children.forEach((child, index) => {
			const isLast = index === children.length - 1
			const currentPrefix = prefix + (isLast ? '└── ' : '├── ')
			const nextPrefix = prefix + (isLast ? '    ' : '│   ')

			if (child instanceof TFolder) {
				result.push(`${currentPrefix}${child.path}/`)

				if (recursive) {
					listFolderContents(child, nextPrefix)
				}
			} else if (child instanceof TFile) {
				result.push(`${currentPrefix}${child.path}`)
			}
		})
	}

	if (startPath) {
		result.push(`${folder.path}/`)
		listFolderContents(folder, '')
	} else {
		result.push(`${vault.getName()}/`)
		listFolderContents(folder, '')
	}

	return result
}

/**
 * 递归列出文件夹内容
 */
const listFolderContentsRecursively = async (folder: TFolder, prefix: string): Promise<string[]> => {
	const result: string[] = []

	const children = [...folder.children].sort((a, b) => {
		if (a instanceof TFolder && b instanceof TFile) return -1
		if (a instanceof TFile && b instanceof TFolder) return 1
		return a.name.localeCompare(b.name)
	})

	for (let i = 0; i < children.length; i++) {
		const child = children[i]
		const isLast = i === children.length - 1
		const currentPrefix = prefix + (isLast ? '└── ' : '├── ')
		const nextPrefix = prefix + (isLast ? '    ' : '│   ')

		if (child instanceof TFolder) {
			result.push(`${currentPrefix}${child.path}/`)
			const subContent = await listFolderContentsRecursively(child, nextPrefix)
			result.push(...subContent)
		} else if (child instanceof TFile) {
			result.push(`${currentPrefix}${child.path}`)
		}
	}

	return result
}

/**
 * 只列出文件夹第一层内容
 */
const listFolderContentsFirstLevel = async (folder: TFolder, prefix: string): Promise<string[]> => {
	const result: string[] = []

	const children = [...folder.children].sort((a, b) => {
		if (a instanceof TFolder && b instanceof TFile) return -1
		if (a instanceof TFile && b instanceof TFolder) return 1
		return a.name.localeCompare(b.name)
	})

	children.forEach((child, index) => {
		const isLast = index === children.length - 1
		const currentPrefix = prefix + (isLast ? '└── ' : '├── ')

		if (child instanceof TFolder) {
			result.push(`${currentPrefix}${child.path}/`)
		} else if (child instanceof TFile) {
			result.push(`${currentPrefix}${child.path}`)
		}
	})

	return result
}

// TODO: Implement match search functionality
// export const matchSearchFiles = async (vault: Vault, path: string, query: string, file_pattern: string) => {
// 
// }

// TODO: Implement regex search functionality  
// export const regexSearchFiles = async (vault: Vault, path: string, regex: string, file_pattern: string) => {
//
// }

/**
 * 语义搜索文件（同时查询原始笔记和抽象洞察）
 */
export const semanticSearchFiles = async (
	ragEngine: RAGEngine, // RAG 引擎实例 - 原始笔记数据库
	query: string,
	path?: string,
	workspace?: Workspace,
	app?: App,
	transEngine?: TransEngine, // Trans 引擎实例 - 抽象洞察数据库
	useInsightInSemanticSearch?: boolean, // 是否在语义搜索中使用洞察
	semanticSearchMethod?: 'hybrid' | 'vector' // 语义搜索方法
): Promise<string> => {
	let scope: { files: string[], folders: string[] } | undefined

	// 如果指定了路径，使用该路径
	if (path && path !== '' && path !== '.' && path !== '/') {
		scope = { files: [], folders: [normalizePath(path)] }
	} 
	// 如果没有指定路径但有工作区，使用工作区范围
	else if (workspace && app) {
		const folders: string[] = []
		const files: string[] = []

		// 处理工作区中的文件夹和标签
		for (const item of workspace.content) {
			if (item.type === 'folder') {
				// 标准化文件夹路径：移除尾部斜杠（除了根路径"/"）
				const folderPath = normalizePath(item.content)
				folders.push(folderPath)
			} else if (item.type === 'tag') {
				// 获取标签对应的所有文件
				const tagFiles = getFilesWithTag(item.content, app)
				files.push(...tagFiles)
			}
		}

		// 只有当有文件夹或文件时才设置 scope
		if (folders.length > 0 || files.length > 0) {
			scope = { files, folders }
		}
	}
	
	const resultSections: string[] = []

	// 1. 查询原始笔记数据库 (RAGEngine)
	try {
		const ragResults = await ragEngine.processQuery({
			query: query,
			scope: scope,
			limit: 10,
			semanticSearchMethod: semanticSearchMethod || 'hybrid', // 传递语义搜索方法
		})

		if (ragResults.length > 0) {
			resultSections.push('## 📝 Original Note Content')
			const ragSnippets = ragResults.map(({ path, content, metadata }: RAGSearchResult) => {
				const contentWithLineNumbers = addLineNumbers(content, metadata.startLine)
				return `<file_block_content location="${path}#L${metadata.startLine}-${metadata.endLine}">\n${contentWithLineNumbers}\n</file_block_content>`
			}).join('\n\n')
			resultSections.push(ragSnippets)
		}
	} catch (error) {
		console.warn('RAG search failed:', error)
		resultSections.push('## 📝 Original Note Content\n⚠️ Original note search failed')
	}

	// 2. 查询抽象洞察数据库 (TransEngine) - 使用新的 processQuery 接口
	if (transEngine && useInsightInSemanticSearch === true) {
		try {
			const insightResults = await transEngine.processQuery({
				query: query,
				scope: scope,
				limit: 10,
				minSimilarity: 0.3,
			})

			if (insightResults.length > 0) {
				resultSections.push('\n## 🧠 AI Abstract Insights')
				
				// Group by transformation type
				const groupedInsights: { [key: string]: InsightSearchResult[] } = {}
				insightResults.forEach(insight => {
					if (!groupedInsights[insight.insight_type]) {
						groupedInsights[insight.insight_type] = []
					}
					groupedInsights[insight.insight_type].push(insight)
				})

				// Render each type of insight
				for (const [insightType, insights] of Object.entries(groupedInsights)) {
					const transformationConfig = TRANSFORMATIONS[insightType as keyof typeof TRANSFORMATIONS]
					const typeName = transformationConfig ? transformationConfig.description : insightType
					
					resultSections.push(`\n### ${typeName}`)
					
					insights.forEach((insight) => {
						const similarity = (insight.similarity * 100).toFixed(1)
						resultSections.push(
							`<insight_block source="${insight.source_path}" type="${insightType}" similarity="${similarity}%">\n${insight.insight}\n</insight_block>`
						)
					})
				}
			}
		} catch (error) {
			console.warn('TransEngine search failed:', error)
			resultSections.push('\n## 🧠 AI Abstract Insights\n⚠️ Insight search failed: ' + (error instanceof Error ? error.message : String(error)))
		}
	}

	// 3. 合并结果
	if (resultSections.length === 0) {
		return `No results found for '${query}'`
	}

	return resultSections.join('\n\n')
}
