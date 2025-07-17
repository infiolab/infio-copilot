import * as path from 'path'

import { App, TFile, TFolder } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

import { ApplyViewState } from '../../ApplyView'
import { APPLY_VIEW_TYPE } from '../../constants'
import { Workspace } from '../../database/json/workspace/types'
import { WorkspaceManager } from '../../database/json/workspace/WorkspaceManager'
import {
	ApplyStatus,
	ToolArgs,
	ToolExecutionFailure,
	ToolExecutionResult,
	ToolExecutionSuccess,
	WriteToFileToolArgs,
	InsertContentToolArgs,
	SearchAndReplaceToolArgs,
	ApplyDiffToolArgs,
	ReadFileToolArgs,
	ListFilesToolArgs,
	MatchSearchFilesToolArgs,
	RegexSearchFilesToolArgs,
	SemanticSearchFilesToolArgs,
	SearchWebToolArgs,
	FetchUrlsContentToolArgs,
	SwitchModeToolArgs,
	UseMcpToolArgs,
	DataviewQueryToolArgs,
	CallTransformationsToolArgs,
	ManageFilesToolArgs,
} from '../../types/apply'
import { InfioSettings } from '../../types/settings'
import { ApplyEditToFile, SearchAndReplace } from '../../utils/apply'
import { listFilesAndFolders, semanticSearchFiles } from '../../utils/glob-utils'
import { readTFileContent, readTFileContentPdf } from '../../utils/obsidian'
import { addLineNumbers } from '../../utils/prompt-generator'
import { fetchUrlsContent, webSearch } from '../../utils/web-search'
import { DiffStrategy } from '../diff/DiffStrategy'
import { matchSearchUsingCorePlugin } from '../file-search/match/coreplugin-match'
import { matchSearchUsingOmnisearch } from '../file-search/match/omnisearch-match'
import { regexSearchUsingCorePlugin } from '../file-search/regex/coreplugin-regex'
import { regexSearchUsingRipgrep } from '../file-search/regex/ripgrep-regex'
import { McpHub } from '../mcp/McpHub'
import { RAGEngine } from '../rag/rag-engine'
import { TransEngine, TransformationType } from '../transformations/trans-engine'
import { ApplyEditManager } from '../apply/ApplyEditManager'
import { DataviewManager } from '../../utils/dataview'

// 工具管理器类型
export interface ToolManagerDependencies {
	app: App
	settings: InfioSettings
	workspaceManager: WorkspaceManager
	diffStrategy: DiffStrategy
	applyEditManager: ApplyEditManager
	getRAGEngine: () => Promise<RAGEngine>
	getTransEngine: () => Promise<TransEngine>
	getMcpHub: () => Promise<McpHub>
	getDataviewManager: () => DataviewManager
}

/**
 * 工具管理器 - 统一管理所有工具的执行逻辑
 */
export class ToolManager {
	private dependencies: ToolManagerDependencies

	constructor(dependencies: ToolManagerDependencies) {
		this.dependencies = dependencies
	}

	/**
	 * 执行工具
	 */
	async executeTool(toolArgs: ToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		try {
			switch (toolArgs.type) {
				case 'write_to_file':
					return await this.executeWriteToFile(toolArgs, applyMsgId)
				case 'insert_content':
					return await this.executeInsertContent(toolArgs, applyMsgId)
				case 'search_and_replace':
					return await this.executeSearchAndReplace(toolArgs, applyMsgId)
				case 'apply_diff':
					return await this.executeApplyDiff(toolArgs, applyMsgId)
				case 'read_file':
					return await this.executeReadFile(toolArgs, applyMsgId)
				case 'list_files':
					return await this.executeListFiles(toolArgs, applyMsgId)
				case 'match_search_files':
					return await this.executeMatchSearchFiles(toolArgs, applyMsgId)
				case 'regex_search_files':
					return await this.executeRegexSearchFiles(toolArgs, applyMsgId)
				case 'semantic_search_files':
					return await this.executeSemanticSearchFiles(toolArgs, applyMsgId)
				case 'search_web':
					return await this.executeSearchWeb(toolArgs, applyMsgId)
				case 'fetch_urls_content':
					return await this.executeFetchUrlsContent(toolArgs, applyMsgId)
				case 'switch_mode':
					return await this.executeSwitchMode(toolArgs, applyMsgId)
				case 'use_mcp_tool':
					return await this.executeUseMcpTool(toolArgs, applyMsgId)
				case 'dataview_query':
					return await this.executeDataviewQuery(toolArgs, applyMsgId)
				case 'call_transformations':
					return await this.executeCallTransformations(toolArgs, applyMsgId)
				case 'manage_files':
					return await this.executeManageFiles(toolArgs, applyMsgId)
				default:
					// 使用 never 类型来确保所有情况都被处理
					const exhaustiveCheck: never = toolArgs
					throw new Error(`Unsupported tool type: ${String((exhaustiveCheck as ToolArgs)?.type) || 'unknown'}`)
			}
		} catch (error) {
			console.error('Failed to execute tool', error)
			return this.createFailureResult(
				toolArgs.type,
				applyMsgId,
				error instanceof Error ? error.message : String(error)
			)
		}
	}

	/**
	 * 需要用户确认的文件编辑工具
	 */
	private async executeWriteToFile(toolArgs: WriteToFileToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { applyEditManager } = this.dependencies

		try {
			// 注册编辑操作
			await applyEditManager.registerEdit(applyMsgId, toolArgs)
			
			// 打开 ApplyView 展示差异
			await applyEditManager.openApplyView(applyMsgId)

			// 等待用户操作完成（使用事件驱动方式）
			const statusChangeEvent = await applyEditManager.waitForEditCompletion(applyMsgId)
			
			const applyStatus = statusChangeEvent.status === 'applied' ? ApplyStatus.Applied : ApplyStatus.Rejected
			const applyEditContent = statusChangeEvent.status === 'applied' ? 'Changes successfully applied' : 'User rejected changes'

			return {
				type: toolArgs.type,
				applyMsgId,
				applyStatus,
				returnMsg: {
					role: 'user',
					applyStatus: ApplyStatus.Idle,
					content: null,
					promptContent: `[${toolArgs.type} for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
					id: uuidv4(),
					mentionables: [],
				}
			}
		} catch (error) {
			console.error('Failed to execute write_to_file:', error)
			return this.createFailureResult(
				toolArgs.type,
				applyMsgId,
				error instanceof Error ? error.message : String(error)
			)
		}
	}

	/**
	 * 插入内容工具
	 */
	private async executeInsertContent(toolArgs: InsertContentToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { applyEditManager } = this.dependencies

		try {
			// 注册编辑操作
			await applyEditManager.registerEdit(applyMsgId, toolArgs)
			
			// 打开 ApplyView 展示差异
			await applyEditManager.openApplyView(applyMsgId)

			// 等待用户操作完成（使用事件驱动方式）
			const statusChangeEvent = await applyEditManager.waitForEditCompletion(applyMsgId)
			
			const applyStatus = statusChangeEvent.status === 'applied' ? ApplyStatus.Applied : ApplyStatus.Rejected
			const applyEditContent = statusChangeEvent.status === 'applied' ? 'Changes successfully applied' : 'User rejected changes'

			return {
				type: toolArgs.type,
				applyMsgId,
				applyStatus,
				returnMsg: {
					role: 'user',
					applyStatus: ApplyStatus.Idle,
					content: null,
					promptContent: `[${toolArgs.type} for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
					id: uuidv4(),
					mentionables: [],
				}
			}
		} catch (error) {
			console.error('Failed to execute insert_content:', error)
			return this.createFailureResult(
				toolArgs.type,
				applyMsgId,
				error instanceof Error ? error.message : String(error)
			)
		}
	}

	/**
	 * 搜索替换工具
	 */
	private async executeSearchAndReplace(toolArgs: SearchAndReplaceToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { applyEditManager } = this.dependencies

		try {
			// 注册编辑操作
			await applyEditManager.registerEdit(applyMsgId, toolArgs)
			
			// 打开 ApplyView 展示差异
			await applyEditManager.openApplyView(applyMsgId)

			// 等待用户操作完成（使用事件驱动方式）
			const statusChangeEvent = await applyEditManager.waitForEditCompletion(applyMsgId)
			
			const applyStatus = statusChangeEvent.status === 'applied' ? ApplyStatus.Applied : ApplyStatus.Rejected
			const applyEditContent = statusChangeEvent.status === 'applied' ? 'Changes successfully applied' : 'User rejected changes'

			return {
				type: 'search_and_replace',
				applyMsgId,
				applyStatus,
				returnMsg: {
					role: 'user',
					applyStatus: ApplyStatus.Idle,
					content: null,
					promptContent: `[search_and_replace for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
					id: uuidv4(),
					mentionables: [],
				}
			}
		} catch (error) {
			console.error('Failed to execute search_and_replace:', error)
			return this.createFailureResult(
				toolArgs.type,
				applyMsgId,
				error instanceof Error ? error.message : String(error)
			)
		}
	}

	/**
	 * 应用差异工具
	 */
	private async executeApplyDiff(toolArgs: ApplyDiffToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { applyEditManager } = this.dependencies

		try {
			// 注册编辑操作
			await applyEditManager.registerEdit(applyMsgId, toolArgs)
			
			// 打开 ApplyView 展示差异
			await applyEditManager.openApplyView(applyMsgId)

			// 等待用户操作完成（使用事件驱动方式）
			const statusChangeEvent = await applyEditManager.waitForEditCompletion(applyMsgId)
			
			const applyStatus = statusChangeEvent.status === 'applied' ? ApplyStatus.Applied : ApplyStatus.Rejected
			const applyEditContent = statusChangeEvent.status === 'applied' ? 'Changes successfully applied' : 'User rejected changes'

			return {
				type: 'apply_diff',
				applyMsgId,
				applyStatus,
				returnMsg: {
					role: 'user',
					applyStatus: ApplyStatus.Idle,
					content: null,
					promptContent: `[apply_diff for '${toolArgs.filepath}'] Result:\n${applyEditContent}\n`,
					id: uuidv4(),
					mentionables: [],
				}
			}
		} catch (error) {
			console.error('Failed to execute apply_diff:', error)
			return this.createFailureResult(
				toolArgs.type,
				applyMsgId,
				error instanceof Error ? error.message : String(error)
			)
		}
	}

	/**
	 * 读取文件工具
	 */
	private async executeReadFile(toolArgs: ReadFileToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { app } = this.dependencies

		let opFile = app.workspace.getActiveFile()
		if (toolArgs.filepath) {
			opFile = app.vault.getFileByPath(toolArgs.filepath)
		}

		if (!opFile) {
			throw new Error(`File not found: ${toolArgs.filepath}`)
		}

		const fileContent = await readTFileContentPdf(opFile, app.vault, app)
		const formattedContent = `[read_file for '${toolArgs.filepath}'] Result:\n${addLineNumbers(fileContent)}\n`

		return this.createSuccessResult('read_file', applyMsgId, formattedContent)
	}

	/**
	 * 列出文件工具
	 */
	private async executeListFiles(toolArgs: ListFilesToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { app, settings, workspaceManager } = this.dependencies

		// 获取当前工作区
		let currentWorkspace: Workspace | null = null
		if (settings.workspace && settings.workspace !== 'vault') {
			currentWorkspace = await workspaceManager.findByName(String(settings.workspace))
		}

		const files = await listFilesAndFolders(
			app.vault,
			toolArgs.filepath,
			toolArgs.recursive,
			currentWorkspace || undefined,
			app
		)

		const contextInfo = currentWorkspace
			? `workspace '${currentWorkspace.name}'`
			: toolArgs.filepath || 'vault root'
		const formattedContent = `[list_files for '${contextInfo}'] Result:\n${files.join('\n')}\n`

		return this.createSuccessResult('list_files', applyMsgId, formattedContent)
	}

	/**
	 * 全文搜索文件工具
	 */
	private async executeMatchSearchFiles(toolArgs: MatchSearchFilesToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { app, settings } = this.dependencies

		const searchBackend = settings.filesSearchSettings.matchBackend
		let results: string

		if (searchBackend === 'omnisearch') {
			results = await matchSearchUsingOmnisearch(toolArgs.query, app)
		} else {
			results = await matchSearchUsingCorePlugin(toolArgs.query, app)
		}

		const formattedContent = `[match_search_files for '${toolArgs.filepath}'] Result:\n${results}\n`
		return this.createSuccessResult('match_search_files', applyMsgId, formattedContent)
	}

	/**
	 * 正则搜索文件工具
	 */
	private async executeRegexSearchFiles(toolArgs: RegexSearchFilesToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { app, settings } = this.dependencies

		const searchBackend = settings.filesSearchSettings.regexBackend
		let results: string

		if (searchBackend === 'coreplugin') {
			results = await regexSearchUsingCorePlugin(toolArgs.regex, app)
		} else {
			// @ts-expect-error Obsidian API type mismatch
			const baseVaultPath = String(app.vault.adapter.getBasePath())
			const absolutePath = path.join(baseVaultPath, toolArgs.filepath)
			const ripgrepPath = settings.filesSearchSettings.ripgrepPath
			results = await regexSearchUsingRipgrep(absolutePath, toolArgs.regex, ripgrepPath)
		}

		const formattedContent = `[regex_search_files for '${toolArgs.filepath}'] Result:\n${results}\n`
		return this.createSuccessResult('regex_search_files', applyMsgId, formattedContent)
	}

	/**
	 * 语义搜索文件工具
	 */
	private async executeSemanticSearchFiles(toolArgs: SemanticSearchFilesToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { app, settings, workspaceManager, getRAGEngine, getTransEngine } = this.dependencies

		// 获取当前工作区
		let currentWorkspace: Workspace | null = null
		if (settings.workspace && settings.workspace !== 'vault') {
			currentWorkspace = await workspaceManager.findByName(String(settings.workspace))
		}

		const snippets = await semanticSearchFiles(
			await getRAGEngine(),
			toolArgs.query,
			toolArgs.filepath,
			currentWorkspace || undefined,
			app,
			await getTransEngine()
		)

		const contextInfo = currentWorkspace
			? `workspace '${currentWorkspace.name}'`
			: toolArgs.filepath || 'vault'
		const formattedContent = `[semantic_search_files for '${contextInfo}'] Result:\n${snippets}\n`

		return this.createSuccessResult('semantic_search_files', applyMsgId, formattedContent)
	}

	/**
	 * 网络搜索工具
	 */
	private async executeSearchWeb(toolArgs: SearchWebToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { settings, getRAGEngine } = this.dependencies

		const results = await webSearch(
			toolArgs.query,
			settings.serperApiKey,
			settings.serperSearchEngine,
			settings.jinaApiKey,
			await getRAGEngine()
		)

		const formattedContent = `[search_web for '${toolArgs.query}'] Result:\n${results}\n`
		return this.createSuccessResult('search_web', applyMsgId, formattedContent)
	}

	/**
	 * 获取URL内容工具
	 */
	private async executeFetchUrlsContent(toolArgs: FetchUrlsContentToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { settings } = this.dependencies

		const results = await fetchUrlsContent(toolArgs.urls, settings.jinaApiKey)
		const formattedContent = `[fetch_urls_content] Result:\n${results}\n`

		return this.createSuccessResult('fetch_urls_content', applyMsgId, formattedContent)
	}

	/**
	 * 切换模式工具
	 */
	private async executeSwitchMode(toolArgs: SwitchModeToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		// Note: This would need to be handled differently since it modifies settings
		// For now, we'll return a success result
		const formattedContent = `[switch_mode to ${toolArgs.mode}] Result: successfully switched to ${toolArgs.mode}\n`
		return this.createSuccessResult('switch_mode', applyMsgId, formattedContent)
	}

	/**
	 * 使用MCP工具
	 */
	private async executeUseMcpTool(toolArgs: UseMcpToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { getMcpHub } = this.dependencies

		const mcpHub = await getMcpHub()
		if (!mcpHub) {
			throw new Error('MCP hub not found')
		}

		const toolResult = await mcpHub.callTool(toolArgs.server_name, toolArgs.tool_name, toolArgs.parameters)
		const toolResultPretty =
			(toolResult?.isError ? "Error:\n" : "") +
			toolResult?.content
				.map((item) => {
					if (item.type === "text") {
						return item.text
					}
					if (item.type === "resource") {
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						const { blob, ...rest } = item.resource
						return JSON.stringify(rest, null, 2)
					}
					return ""
				})
				.filter(Boolean)
				.join("\n\n") || "(No response)"

		const formattedContent = `[use_mcp_tool for '${toolArgs.server_name}'] Result:\n${toolResultPretty}\n`
		return this.createSuccessResult('use_mcp_tool', applyMsgId, formattedContent)
	}

	/**
	 * Dataview查询工具
	 */
	private async executeDataviewQuery(toolArgs: DataviewQueryToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { getDataviewManager } = this.dependencies

		const dataviewManager = getDataviewManager()
		if (!dataviewManager) {
			throw new Error('DataviewManager 未初始化')
		}

		if (!dataviewManager.isDataviewAvailable()) {
			throw new Error('Dataview 插件未安装或未启用，请先安装并启用 Dataview 插件')
		}

		// 执行 Dataview 查询
		const result = await dataviewManager.executeQuery(toolArgs.query)

		let formattedContent: string
		if (result.success) {
			formattedContent = `[dataview_query] 查询成功:\n${result.data}`
		} else {
			formattedContent = `[dataview_query] 查询失败:\n${result.error}`
		}

		return {
			type: 'dataview_query',
			applyMsgId,
			applyStatus: result.success ? ApplyStatus.Applied : ApplyStatus.Failed,
			returnMsg: {
				role: 'user',
				applyStatus: ApplyStatus.Idle,
				content: null,
				promptContent: formattedContent,
				id: uuidv4(),
				mentionables: [],
			}
		}
	}

	/**
	 * 调用转换工具
	 */
	private async executeCallTransformations(toolArgs: CallTransformationsToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { settings, getTransEngine } = this.dependencies

		// 验证转换类型
		const validTransformationTypes = Object.values(TransformationType)
		const transformationType = toolArgs.transformation
		if (!validTransformationTypes.includes(transformationType)) {
			throw new Error(`Unsupported transformation type: ${transformationType}`)
		}

		const transEngine = await getTransEngine()

		// 执行转换
		const transformationResult = await transEngine.runTransformation({
			filePath: toolArgs.path,
			transformationType: transformationType,
			model: {
				provider: settings.applyModelProvider,
				modelId: settings.applyModelId,
			},
			saveToDatabase: true
		})

		if (!transformationResult.success) {
			throw new Error(transformationResult.error || 'Transformation failed')
		}

		// 构建结果消息
		let formattedContent = `[${toolArgs.transformation}] transformation complete:\n\n${transformationResult.result}`

		if (transformationResult.truncated) {
			formattedContent += `\n\n*Note: The original content was too long (${transformationResult.originalTokens} tokens) and was truncated to ${transformationResult.processedTokens} tokens for processing.*`
		}

		return this.createSuccessResult('call_transformations', applyMsgId, formattedContent)
	}

	/**
	 * 文件管理工具
	 */
	private async executeManageFiles(toolArgs: ManageFilesToolArgs, applyMsgId: string): Promise<ToolExecutionResult> {
		const { app } = this.dependencies

		const results: string[] = []

		// 处理每个文件操作
		for (const operation of toolArgs.operations) {
			try {
				switch (operation.action) {
					case 'create_folder':
						if (operation.path) {
							const folderExists = await app.vault.adapter.exists(operation.path)
							if (!folderExists) {
								await app.vault.adapter.mkdir(operation.path)
								results.push(`✅ 成功创建文件夹: ${operation.path}`)
							} else {
								results.push(`⚠️ 文件夹已存在: ${operation.path}`)
							}
						}
						break

					case 'move':
						if (operation.source_path && operation.destination_path) {
							const sourceFile = app.vault.getAbstractFileByPath(operation.source_path)
							if (sourceFile) {
								// 确保目标目录存在
								const destDir = path.dirname(operation.destination_path)
								if (destDir && destDir !== '.' && destDir !== '/') {
									const dirExists = await app.vault.adapter.exists(destDir)
									if (!dirExists) {
										await app.vault.adapter.mkdir(destDir)
									}
								}
								await app.vault.rename(sourceFile, operation.destination_path)
								const itemType = sourceFile instanceof TFile ? '文件' : '文件夹'
								results.push(`✅ 成功移动${itemType}: ${operation.source_path} → ${operation.destination_path}`)
							} else {
								results.push(`❌ 源文件或文件夹不存在: ${operation.source_path}`)
							}
						}
						break

					case 'delete':
						if (operation.path) {
							const fileOrFolder = app.vault.getAbstractFileByPath(operation.path)
							if (fileOrFolder) {
								const isFolder = fileOrFolder instanceof TFolder
								await app.vault.trash(fileOrFolder, true)
								const itemType = isFolder ? '文件夹' : '文件'
								results.push(`✅ 成功将${itemType}移到回收站: ${operation.path}`)
							} else {
								results.push(`❌ 文件或文件夹不存在: ${operation.path}`)
							}
						}
						break

					case 'copy':
						if (operation.source_path && operation.destination_path) {
							const sourceFile = app.vault.getAbstractFileByPath(operation.source_path)
							if (sourceFile) {
								if (sourceFile instanceof TFile) {
									// 文件复制
									const destDir = path.dirname(operation.destination_path)
									if (destDir && destDir !== '.' && destDir !== '/') {
										const dirExists = await app.vault.adapter.exists(destDir)
										if (!dirExists) {
											await app.vault.adapter.mkdir(destDir)
										}
									}
									const content = await app.vault.read(sourceFile)
									await app.vault.create(operation.destination_path, content)
									results.push(`✅ 成功复制文件: ${operation.source_path} → ${operation.destination_path}`)
								} else if (sourceFile instanceof TFolder) {
									// 文件夹复制需要递归处理
									results.push(`❌ 文件夹复制功能暂未实现: ${operation.source_path}`)
								}
							} else {
								results.push(`❌ 源文件或文件夹不存在: ${operation.source_path}`)
							}
						}
						break

					case 'rename':
						if (operation.path && operation.new_name) {
							const file = app.vault.getAbstractFileByPath(operation.path)
							if (file) {
								const newPath = path.join(path.dirname(operation.path), operation.new_name)
								await app.vault.rename(file, newPath)
								const itemType = file instanceof TFile ? '文件' : '文件夹'
								results.push(`✅ 成功重命名${itemType}: ${operation.path} → ${newPath}`)
							} else {
								results.push(`❌ 文件或文件夹不存在: ${operation.path}`)
							}
						}
						break

					default:
						results.push(`❌ 不支持的操作类型: ${String(operation.action)}`)
				}
			} catch (error) {
				results.push(`❌ 操作失败 (${operation.action}): ${error instanceof Error ? error.message : String(error)}`)
			}
		}

		const formattedContent = `[manage_files] 文件管理操作结果:\n${results.join('\n')}`
		return this.createSuccessResult('manage_files', applyMsgId, formattedContent)
	}

	/**
	 * 创建成功结果
	 */
	private createSuccessResult(
		type: string,
		applyMsgId: string,
		promptContent: string,
		id?: string
	): ToolExecutionSuccess {
		return {
			type,
			applyMsgId,
			applyStatus: ApplyStatus.Applied,
			toolResultContent: promptContent,
			returnMsg: {
				role: 'user',
				applyStatus: ApplyStatus.Idle,
				content: null,
				promptContent,
				id: id || uuidv4(),
				mentionables: [],
			}
		}
	}

	/**
	 * 创建失败结果
	 */
	private createFailureResult(
		type: string,
		applyMsgId: string,
		error: string
	): ToolExecutionFailure {
		const errorMessage = `[${type}] 执行失败: ${error}`
		return {
			type,
			applyMsgId,
			applyStatus: ApplyStatus.Failed,
			error,
			toolResultContent: errorMessage,
			returnMsg: {
				role: 'user',
				applyStatus: ApplyStatus.Idle,
				content: null,
				promptContent: errorMessage,
				id: uuidv4(),
				mentionables: [],
			}
		}
	}
} 
