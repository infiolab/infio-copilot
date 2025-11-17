import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '../../contexts/AppContext'
import { useSettings } from '../../contexts/SettingsContext'
import { useTrans } from '../../contexts/TransContext'
import { InitWorkspaceInsightResult } from '../../core/transformations/trans-engine'
import { Workspace } from '../../database/json/workspace/types'
import { WorkspaceManager } from '../../database/json/workspace/WorkspaceManager'
import { SelectSourceInsight } from '../../database/schema'
import { t } from '../../lang/helpers'
import { getFilesWithTag } from '../../utils/glob-utils'
import { openMarkdownFile } from '../../utils/obsidian'

import { ModelSelect } from './chat-input/ModelSelect'

// 洞察源分组结果接口
interface InsightFileGroup {
	path: string
	fileName: string
	maxCreatedAt: number
	insights: (Omit<SelectSourceInsight, 'embedding'> & { displayTime: string })[]
	groupType?: 'file' | 'folder' | 'workspace'
}

const InsightView = () => {
	const { getTransEngine } = useTrans()
	const app = useApp()
	const { settings } = useSettings()

	// 工作区管理器
	const workspaceManager = useMemo(() => {
		return new WorkspaceManager(app)
	}, [app])

	const [insightResults, setInsightResults] = useState<(Omit<SelectSourceInsight, 'embedding'> & { displayTime: string })[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [hasLoaded, setHasLoaded] = useState(false)
	// 展开状态管理 - 默认全部展开
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
	// 当前搜索范围信息
	const [currentScope, setCurrentScope] = useState<string>('')
	// 分页状态
	const [currentPage, setCurrentPage] = useState<number>(1)
	const [totalPages, setTotalPages] = useState<number>(0)
	const [totalInsights, setTotalInsights] = useState<number>(0)
	const [pageSize] = useState<number>(50)
	// 初始化洞察状态
	const [isInitializing, setIsInitializing] = useState(false)
	const [initProgress, setInitProgress] = useState<{
		stage: string
		current: number
		total: number
		currentItem: string
		percentage?: number
	} | null>(null)
	const [initSuccess, setInitSuccess] = useState<{
		show: boolean
		result?: InitWorkspaceInsightResult
		workspaceName?: string
	}>({ show: false })

	// 删除洞察状态
	const [isDeleting, setIsDeleting] = useState(false)
	const [deletingInsightId, setDeletingInsightId] = useState<number | null>(null)
	// 确认对话框状态
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
	const [showInitConfirm, setShowInitConfirm] = useState(false)

	const loadInsights = useCallback(async () => {
		setIsLoading(true)
		setHasLoaded(true)

		try {
			// 获取当前工作区
			let currentWorkspace: Workspace | null = null
			if (settings.workspace && settings.workspace !== 'vault') {
				currentWorkspace = await workspaceManager.findByName(String(settings.workspace))
			}

			// 设置范围信息
			let scopeDescription = ''
			if (currentWorkspace) {
				scopeDescription = `${t('insights.fileGroup.workspacePrefix')} ${currentWorkspace.name}`
			} else {
				scopeDescription = t('insights.stats.scopeLabel') + ' ' + t('workspace.entireVault')
			}
			setCurrentScope(scopeDescription)

			const transEngine = await getTransEngine()
			const pageResult = await transEngine.getInsightsPage(currentPage, pageSize)
			const allInsights = pageResult.insights
			setTotalInsights(pageResult.totalCount)
			setTotalPages(pageResult.totalPages)

			// 构建工作区范围集合（包含文件、文件夹、工作区路径）
			let workspacePaths: Set<string> | null = null
			if (currentWorkspace) {
				workspacePaths = new Set<string>()

				// 添加工作区路径
				workspacePaths.add(`workspace:${currentWorkspace.name}`)

				// 处理工作区中的文件夹和标签
				for (const item of currentWorkspace.content) {
					if (item.type === 'folder') {
						const folderPath = item.content

						// 添加文件夹路径本身
						workspacePaths.add(folderPath)

						// 获取文件夹下的所有文件
						const files = app.vault.getMarkdownFiles().filter(file =>
							file.path.startsWith(folderPath === '/' ? '' : folderPath + '/')
						)

						// 添加所有文件路径
						files.forEach(file => {
							workspacePaths.add(file.path)

							// 添加中间文件夹路径
							const dirPath = file.path.substring(0, file.path.lastIndexOf('/'))
							if (dirPath && dirPath !== folderPath) {
								let currentPath = folderPath === '/' ? '' : folderPath
								const pathParts = dirPath.substring(currentPath.length).split('/').filter(Boolean)

								for (let i = 0; i < pathParts.length; i++) {
									currentPath += (currentPath ? '/' : '') + pathParts[i]
									workspacePaths.add(currentPath)
								}
							}
						})

					} else if (item.type === 'tag') {
						// 获取标签对应的所有文件
						const tagFiles = getFilesWithTag(item.content, app)

						tagFiles.forEach(filePath => {
							workspacePaths.add(filePath)

							// 添加文件所在的文件夹路径
							const dirPath = filePath.substring(0, filePath.lastIndexOf('/'))
							if (dirPath) {
								const pathParts = dirPath.split('/').filter(Boolean)
								let currentPath = ''

								for (let i = 0; i < pathParts.length; i++) {
									currentPath += (currentPath ? '/' : '') + pathParts[i]
									workspacePaths.add(currentPath)
								}
							}
						})
					}
				}
			}

			// 过滤洞察
			let filteredInsights = allInsights
			if (workspacePaths) {
				filteredInsights = allInsights.filter(insight =>
					workspacePaths.has(insight.source_path)
				)
			}

			// 按创建时间排序（数据库已排序，这里保持一致）
			const sortedInsights = filteredInsights
				.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

			// 添加显示时间
			const insightsWithDisplayTime = sortedInsights.map(insight => ({
				...insight,
				displayTime: insight.created_at.toLocaleString('zh-CN')
			}))

			setInsightResults(insightsWithDisplayTime)

		} catch (error) {
			console.error('加载洞察失败:', error)
			setInsightResults([])
		} finally {
			setIsLoading(false)
		}
	}, [getTransEngine, settings, workspaceManager, app, currentPage, pageSize])

	// 组件加载时自动获取洞察
	useEffect(() => {
		loadInsights()
	}, [loadInsights])

	// 监听分页变化，重新加载数据
	useEffect(() => {
		if (hasLoaded) {
			loadInsights()
		}
	}, [currentPage, hasLoaded, loadInsights])

	// 初始化工作区洞察
	const initializeWorkspaceInsights = useCallback(async () => {
		setIsInitializing(true)
		setInitProgress(null)

		try {
			// 获取当前工作区
			let currentWorkspace: Workspace | null = null
			if (settings.workspace && settings.workspace !== 'vault') {
				currentWorkspace = await workspaceManager.findByName(String(settings.workspace))
			}

			if (!currentWorkspace) {
				// 如果没有当前工作区，使用默认的 vault 工作区
				currentWorkspace = await workspaceManager.ensureDefaultVaultWorkspace()
			}

			const transEngine = await getTransEngine()

			// 使用新的 initWorkspaceInsight 方法
			const result = await transEngine.initWorkspaceInsight({
				workspace: currentWorkspace,
				model: {
					provider: settings.insightModelProvider || settings.chatModelProvider,
					modelId: settings.insightModelId || settings.chatModelId,
				},
				onProgress: (progress) => {
					setInitProgress({
						stage: progress.stage,
						current: progress.current,
						total: progress.total,
						currentItem: progress.currentItem,
						percentage: progress.percentage
					})
				}
			})

			if (result.success) {
				// 刷新洞察列表
				await loadInsights()

				// 显示成功消息和统计信息
				console.log(t('insights.success.workspaceInitialized', { name: currentWorkspace.name }))
				console.log(`✅ 深度处理完成统计:`)
				console.log(`📁 文件: ${result.processedFiles} 个处理成功`)
				console.log(`📂 文件夹: ${result.processedFolders} 个处理成功`)
				console.log(`📊 总计: ${result.totalItems} 个项目（包含所有子项目）`)
				if (result.skippedItems > 0) {
					console.log(`⚠️  跳过: ${result.skippedItems} 个项目`)
				}
				if (result.insightId) {
					console.log(`🔍 洞察ID: ${result.insightId}`)
				}
				console.log(`💡 工作区摘要仅使用顶层配置项目，避免内容重叠`)

				// 显示成功状态
				setInitSuccess({
					show: true,
					result: result,
					workspaceName: currentWorkspace.name
				})

				// 3秒后自动隐藏成功消息
				setTimeout(() => {
					setInitSuccess({ show: false })
				}, 5000)

			} else {
				console.error(t('insights.error.initializationFailed'), result.error)
				throw new Error(String(result.error || t('insights.error.initializationFailed')))
			}

		} catch (error) {
			console.error(t('insights.error.initializationFailed'), error)
			setInsightResults([])
			setInitSuccess({ show: false }) // 清理成功状态
		} finally {
			setIsInitializing(false)
			setInitProgress(null)
		}
	}, [getTransEngine, settings, workspaceManager, loadInsights])



	// 确认初始化/更新洞察
	const handleInitWorkspaceInsights = useCallback(() => {
		setShowInitConfirm(true)
	}, [])

	// 删除工作区洞察
	const deleteWorkspaceInsights = useCallback(async () => {
		setIsDeleting(true)

		try {
			// 获取当前工作区
			let currentWorkspace: Workspace | null = null
			if (settings.workspace && settings.workspace !== 'vault') {
				currentWorkspace = await workspaceManager.findByName(String(settings.workspace))
			}

			const transEngine = await getTransEngine()

			// 删除工作区的所有转换
			const result = await transEngine.deleteWorkspaceTransformations(currentWorkspace)

			if (result.success) {
				const workspaceName = currentWorkspace?.name || 'vault'
				console.log(t('insights.success.workspaceDeleted', { name: workspaceName, count: result.deletedCount }))

				// 刷新洞察列表
				await loadInsights()

				// 可以在这里添加用户通知，比如显示删除成功的消息
			} else {
				console.error(t('insights.error.deletionFailed'), result.error)
				// 可以在这里添加错误提示
			}

		} catch (error) {
			console.error(t('insights.error.deletionFailed'), error)
			// 可以在这里添加错误提示
		} finally {
			setIsDeleting(false)
		}
	}, [getTransEngine, settings, workspaceManager, loadInsights])

	// 确认删除工作区洞察
	const confirmDeleteWorkspaceInsights = useCallback(async () => {
		setShowDeleteConfirm(false)
		await deleteWorkspaceInsights()
	}, [deleteWorkspaceInsights])

	// 取消删除确认
	const cancelDeleteConfirm = useCallback(() => {
		setShowDeleteConfirm(false)
	}, [])

	// 确认初始化洞察
	const confirmInitWorkspaceInsights = useCallback(async () => {
		setShowInitConfirm(false)
		await initializeWorkspaceInsights()
	}, [initializeWorkspaceInsights])

	// 取消初始化确认
	const cancelInitConfirm = useCallback(() => {
		setShowInitConfirm(false)
	}, [])

	// 删除单个洞察
	const deleteSingleInsight = useCallback(async (insightId: number) => {
		setDeletingInsightId(insightId)

		try {
			const transEngine = await getTransEngine()

			// 删除单个洞察
			const result = await transEngine.deleteSingleInsight(insightId)

			if (result.success) {
				console.log(t('insights.success.insightDeleted', { id: insightId }))

				// 刷新洞察列表
				await loadInsights()
			} else {
				console.error(t('insights.error.singleDeletionFailed'), result.error)
				// 可以在这里添加错误提示
			}

		} catch (error) {
			console.error(t('insights.error.singleDeletionFailed'), error)
			// 可以在这里添加错误提示
		} finally {
			setDeletingInsightId(null)
		}
	}, [getTransEngine, loadInsights])

	const handleInsightClick = (insight: Omit<SelectSourceInsight, 'embedding'>) => {
		// 如果用户正在选择文本，不触发点击事件
		const selection = window.getSelection()
		if (selection && selection.toString().length > 0) {
			return
		}

		console.debug('🔍 [InsightView] 点击洞察结果:', {
			id: insight.id,
			path: insight.source_path,
			type: insight.insight_type,
			sourceType: insight.source_type,
			content: insight.insight.substring(0, 100) + '...'
		})

		// 检查路径是否存在
		if (!insight.source_path) {
			console.error(t('insights.error.fileNotFound') + ' ' + insight.source_path)
			return
		}

		// 根据洞察类型处理不同的点击行为
		if (insight.source_path.startsWith('workspace:')) {
			// 工作区洞察 - 显示详细信息或切换工作区
			const workspaceName = insight.source_path.replace('workspace:', '')
			console.debug('🌐 [InsightView] 点击工作区洞察:', workspaceName)
			// TODO: 可以实现切换到该工作区或显示工作区详情
			return
		} else if (insight.source_type === 'folder') {
			// 文件夹洞察 - 在文件管理器中显示文件夹
			console.debug('📁 [InsightView] 点击文件夹洞察:', insight.source_path)

			// 尝试在 Obsidian 文件管理器中显示文件夹
			const folder = app.vault.getAbstractFileByPath(insight.source_path)
			if (folder) {
				// 在文件管理器中显示文件夹
				const fileExplorer = app.workspace.getLeavesOfType('file-explorer')[0]
				if (fileExplorer) {
					// @ts-expect-error 使用 Obsidian 内部 API
					fileExplorer.view.revealInFolder(folder)
				}
				console.debug('✅ [InsightView] 在文件管理器中显示文件夹')
			} else {
				console.warn(t('insights.error.folderNotFound'), insight.source_path)
			}
			return
		} else {
			// 文件洞察 - 正常打开文件
			const file = app.vault.getFileByPath(insight.source_path)
			if (!file) {
				console.error(t('insights.error.fileNotFound'), insight.source_path)
				return
			}

			console.debug('✅ [InsightView] 文件存在，准备打开:', {
				file: file.path
			})

			try {
				openMarkdownFile(app, insight.source_path)
				console.debug('✅ [InsightView] 成功调用openMarkdownFile')
			} catch (error) {
				console.error('❌ [InsightView] 调用openMarkdownFile失败:', error)
			}
		}
	}

	const toggleFileExpansion = (filePath: string) => {
		// 如果用户正在选择文本，不触发点击事件
		const selection = window.getSelection()
		if (selection && selection.toString().length > 0) {
			return
		}

		const newExpandedFiles = new Set(expandedFiles)
		if (newExpandedFiles.has(filePath)) {
			newExpandedFiles.delete(filePath)
		} else {
			newExpandedFiles.add(filePath)
		}
		setExpandedFiles(newExpandedFiles)
	}

	// 按源路径分组并排序
	const insightGroupedResults = useMemo(() => {
		if (!insightResults.length) return []

		// 按源路径分组
		const sourceGroups = new Map<string, InsightFileGroup>()

		insightResults.forEach(result => {
			const sourcePath = result.source_path
			let displayName = sourcePath
			let groupType = 'file'

			// 根据源路径类型确定显示名称和类型
			if (sourcePath.startsWith('workspace:')) {
				const workspaceName = sourcePath.replace('workspace:', '')
				displayName = `${t('insights.fileGroup.workspacePrefix')} ${workspaceName}`
				groupType = 'workspace'
			} else if (result.source_type === 'folder') {
				displayName = `${t('insights.fileGroup.folderPrefix')} ${sourcePath.split('/').pop() || sourcePath}`
				groupType = 'folder'
			} else {
				displayName = sourcePath.split('/').pop() || sourcePath
				groupType = 'file'
			}

			if (!sourceGroups.has(sourcePath)) {
				sourceGroups.set(sourcePath, {
					path: sourcePath,
					fileName: displayName,
					maxCreatedAt: result.created_at.getTime(),
					insights: [],
					groupType: groupType === 'workspace' ? 'workspace' : groupType === 'folder' ? 'folder' : 'file'
				})
			}

			const group = sourceGroups.get(sourcePath)
			if (group) {
				group.insights.push(result)
				// 更新最新创建时间
				if (result.created_at.getTime() > group.maxCreatedAt) {
					group.maxCreatedAt = result.created_at.getTime()
				}
			}
		})

		// 对每个组内的洞察按创建时间排序
		sourceGroups.forEach(group => {
			group.insights.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())
		})

		// 按类型和时间排序：工作区 > 文件夹 > 文件
		return Array.from(sourceGroups.values()).sort((a, b) => {
			// 首先按类型排序
			const typeOrder = { workspace: 0, folder: 1, file: 2 }
			const typeComparison = typeOrder[a.groupType || 'file'] - typeOrder[b.groupType || 'file']
			if (typeComparison !== 0) return typeComparison

			// 同类型按时间排序
			return b.maxCreatedAt - a.maxCreatedAt
		})
	}, [insightResults])

	// 获取洞察类型的显示名称
	const getInsightTypeDisplayName = (insightType: string) => {
		const typeMapping: Record<string, string> = {
			'dense_summary': t('insights.types.denseSummary'),
			'simple_summary': t('insights.types.simpleSummary'),
			'key_insights': t('insights.types.keyInsights'),
			'analyze_paper': t('insights.types.analyzePaper'),
			'table_of_contents': t('insights.types.tableOfContents'),
			'reflections': t('insights.types.reflections')
		}
		return typeMapping[insightType] || insightType.toUpperCase()
	}

	return (
		<div className="obsidian-insight-container">
			{/* 头部信息 */}
			<div className="obsidian-insight-header">
				<div className="obsidian-insight-title">
					<h3>{t('insights.title')}</h3>
					<div className="obsidian-insight-actions">
						{/* <button
							onClick={handleDeleteWorkspaceInsights}
							disabled={isDeleting || isLoading || isInitializing}
							className="obsidian-insight-delete-btn"
							title={t('insights.tooltips.clear')}
						>
							{isDeleting ? t('insights.deleting') : t('insights.clearInsights')}
						</button> */}
						<button
							onClick={loadInsights}
							disabled={isLoading || isInitializing || isDeleting}
							className="obsidian-insight-refresh-btn"
							title={isLoading ? t('insights.loading') : t('insights.refresh')}
						>
							<RotateCcw size={16} className={isLoading ? 'spinning' : ''} />
						</button>
					</div>
				</div>

				{/* 结果统计 & 洞察操作 */}
				<div className="infio-insight-stats">
					{hasLoaded && !isLoading && (
						<div className="infio-insight-stats-overview">
							<div className="infio-insight-stats-main">
								<span className="infio-insight-stats-number">
									{totalInsights}
								</span>
								<span className="infio-insight-stats-label">{t('insights.stats.insightCount')}</span>
								{totalPages > 1 && (
									<span className="infio-insight-stats-page">
										Page {currentPage} of {totalPages}
									</span>
								)}
							</div>
							<div className="infio-insight-stats-breakdown">
								{insightGroupedResults.length > 0 && (
									<div className="infio-insight-stats-items">
										{insightGroupedResults.filter(g => g.groupType === 'workspace').length > 0 && (
											<div className="infio-insight-stats-item">
												<span className="infio-insight-stats-item-icon">🌐</span>
												<span className="infio-insight-stats-item-value">
													{insightGroupedResults.filter(g => g.groupType === 'workspace').length}
												</span>
												<span className="infio-insight-stats-item-label">{t('insights.stats.workspaceCount')}</span>
											</div>
										)}
										{insightGroupedResults.filter(g => g.groupType === 'folder').length > 0 && (
											<div className="infio-insight-stats-item">
												<span className="infio-insight-stats-item-icon">📂</span>
												<span className="infio-insight-stats-item-value">
													{insightGroupedResults.filter(g => g.groupType === 'folder').length}
												</span>
												<span className="infio-insight-stats-item-label">{t('insights.stats.folderCount')}</span>
											</div>
										)}
										{insightGroupedResults.filter(g => g.groupType === 'file').length > 0 && (
											<div className="infio-insight-stats-item">
												<span className="infio-insight-stats-item-icon">📄</span>
												<span className="infio-insight-stats-item-value">
													{insightGroupedResults.filter(g => g.groupType === 'file').length}
												</span>
												<span className="infio-insight-stats-item-label">{t('insights.stats.fileCount')}</span>
											</div>
										)}
									</div>
								)}
							</div>
						</div>
					)}
					<div className="infio-insight-model-info">
						<div className="infio-insight-model-row">
							<span className="infio-insight-model-label">{t('insights.stats.insightModelLabel')}</span>
							<ModelSelect modelType="insight" />
						</div>
						<div className="infio-insight-actions">
							<button
								onClick={handleInitWorkspaceInsights}
								disabled={isInitializing || isLoading || isDeleting}
								className="infio-insight-primary-btn"
								title={hasLoaded && insightResults.length > 0 ? t('insights.tooltips.update') : t('insights.tooltips.initialize')}
							>
								{isInitializing ? t('insights.initializing') : (hasLoaded && insightResults.length > 0 ? t('insights.updateInsights') : t('insights.initializeInsights'))}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* 分页控件 */}
			{hasLoaded && !isLoading && totalPages > 1 && (
				<div className="infio-insight-pagination">
					<button
						onClick={() => setCurrentPage(1)}
						disabled={currentPage === 1}
						className="infio-insight-pagination-btn"
						title="First page"
					>
						«
					</button>
					<button
						onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
						disabled={currentPage === 1}
						className="infio-insight-pagination-btn"
						title="Previous page"
					>
						‹
					</button>
					
					<div className="infio-insight-pagination-info">
						<input
							type="number"
							min="1"
							max={totalPages}
							value={currentPage}
							onChange={(e) => {
								const page = parseInt(e.target.value)
								if (page >= 1 && page <= totalPages) {
									setCurrentPage(page)
								}
							}}
							className="infio-insight-pagination-input"
						/>
						<span className="infio-insight-pagination-total">/ {totalPages}</span>
					</div>
					
					<button
						onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
						disabled={currentPage === totalPages}
						className="infio-insight-pagination-btn"
						title="Next page"
					>
						›
					</button>
					<button
						onClick={() => setCurrentPage(totalPages)}
						disabled={currentPage === totalPages}
						className="infio-insight-pagination-btn"
						title="Last page"
					>
						»
					</button>
				</div>
			)}

			{/* 加载进度 */}
			{isLoading && (
				<div className="obsidian-insight-loading">
					{t('insights.loading')}
				</div>
			)}

			{/* 初始化进度 */}
			{isInitializing && (
				<div className="obsidian-insight-initializing">
					<div className="obsidian-insight-init-header">
						<h4>{t('insights.initializingWorkspace')}</h4>
						<p>{t('insights.initializingDescription')}</p>
					</div>
					{initProgress && (
						<div className="obsidian-insight-progress">
							<div className="obsidian-insight-progress-info">
								<span className="obsidian-insight-progress-stage">{initProgress.stage}</span>
								<span className="obsidian-insight-progress-counter">
									{initProgress.current} / {initProgress.total}
								</span>
							</div>
							<div className="obsidian-insight-progress-bar">
								<div
									className="obsidian-insight-progress-fill"
									style={{
										width: `${initProgress.percentage !== undefined ? initProgress.percentage : (initProgress.current / Math.max(initProgress.total, 1)) * 100}%`
									}}
								></div>
							</div>
							<div className="obsidian-insight-progress-details">
								<div className="obsidian-insight-progress-item">
									{initProgress.currentItem}
								</div>
								<div className="obsidian-insight-progress-percentage">
									{initProgress.percentage !== undefined ? initProgress.percentage : Math.round((initProgress.current / Math.max(initProgress.total, 1)) * 100)}%
								</div>
							</div>
							{/* 进度日志 */}
							<div className="obsidian-insight-progress-log">
								<div className="obsidian-insight-progress-log-item">
									<span className="obsidian-insight-progress-log-label">{t('insights.progress.stage')}</span>
									<span className="obsidian-insight-progress-log-value">{initProgress.stage}</span>
								</div>
								<div className="obsidian-insight-progress-log-item">
									<span className="obsidian-insight-progress-log-label">{t('insights.progress.progressLabel')}</span>
									<span className="obsidian-insight-progress-log-value">{initProgress.current} / {initProgress.total}</span>
								</div>
								<div className="obsidian-insight-progress-log-item">
									<span className="obsidian-insight-progress-log-label">{t('insights.progress.currentLabel')}</span>
									<span className="obsidian-insight-progress-log-value">{initProgress.currentItem}</span>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{/* 初始化成功消息 */}
			{initSuccess.show && initSuccess.result && (
				<div className="obsidian-insight-success">
					<div className="obsidian-insight-success-content">
						<span className="obsidian-insight-success-icon">✅</span>
						<div className="obsidian-insight-success-text">
							<span className="obsidian-insight-success-title">
								{t('insights.success.workspaceInitialized', { name: initSuccess.workspaceName })}
							</span>
						</div>
						<button
							className="obsidian-insight-success-close"
							onClick={() => setInitSuccess({ show: false })}
						>
							×
						</button>
					</div>
				</div>
			)}

			{/* 确认删除对话框 */}
			{showDeleteConfirm && (
				<div className="obsidian-confirm-dialog-overlay">
					<div className="obsidian-confirm-dialog">
						<div className="obsidian-confirm-dialog-header">
							<h3>{t('insights.deleteConfirm.title')}</h3>
						</div>
						<div className="obsidian-confirm-dialog-body">
							<p>
								{t('insights.deleteConfirm.message')}
							</p>
							<p className="obsidian-confirm-dialog-warning">
								{t('insights.deleteConfirm.warning')}
							</p>
							<div className="obsidian-confirm-dialog-scope">
								<strong>{t('insights.deleteConfirm.scopeLabel')}</strong> {currentScope}
							</div>
						</div>
						<div className="obsidian-confirm-dialog-footer">
							<button
								onClick={cancelDeleteConfirm}
								className="obsidian-confirm-dialog-cancel-btn"
							>
								{t('insights.deleteConfirm.cancel')}
							</button>
							<button
								onClick={confirmDeleteWorkspaceInsights}
								className="obsidian-confirm-dialog-confirm-btn"
							>
								{t('insights.deleteConfirm.confirm')}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 确认初始化/更新对话框 */}
			{showInitConfirm && (
				<div className="obsidian-confirm-dialog-overlay">
					<div className="obsidian-confirm-dialog">
						<div className="obsidian-confirm-dialog-header">
							<h3>{hasLoaded && insightResults.length > 0 ? t('insights.initConfirm.updateTitle') : t('insights.initConfirm.initTitle')}</h3>
						</div>
						<div className="obsidian-confirm-dialog-body">
							<p>
								{hasLoaded && insightResults.length > 0 ? t('insights.initConfirm.updateMessage') : t('insights.initConfirm.initMessage')}
							</p>
							<div className="obsidian-confirm-dialog-info">
								<div className="obsidian-confirm-dialog-info-item">
									<strong>{t('insights.initConfirm.modelLabel')}</strong>
									<span className="obsidian-confirm-dialog-model">
										{settings.insightModelId}
									</span>
								</div>
								<div className="obsidian-confirm-dialog-info-item">
									<strong>{t('insights.initConfirm.workspaceLabel')}</strong>
									<span className="obsidian-confirm-dialog-workspace">
										{settings.workspace === 'vault' ? t('workspace.entireVault') : settings.workspace}
									</span>
								</div>
							</div>
							<p className="obsidian-confirm-dialog-warning">
								{hasLoaded && insightResults.length > 0 ? t('insights.initConfirm.updateWarning') : t('insights.initConfirm.initWarning')}
							</p>
						</div>
						<div className="obsidian-confirm-dialog-footer">
							<button
								onClick={cancelInitConfirm}
								className="obsidian-confirm-dialog-cancel-btn"
							>
								{t('insights.initConfirm.cancel')}
							</button>
							<button
								onClick={confirmInitWorkspaceInsights}
								className="obsidian-confirm-dialog-confirm-btn"
							>
								{hasLoaded && insightResults.length > 0 ? t('insights.initConfirm.updateConfirm') : t('insights.initConfirm.initConfirm')}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 洞察结果 */}
			<div className="obsidian-insight-results">
				{!isLoading && insightGroupedResults.length > 0 && (
					<div className="obsidian-results-list">
						{insightGroupedResults.map((fileGroup) => (
							<div key={fileGroup.path} className="obsidian-file-group">
								{/* 文件头部 */}
								<div
									className="obsidian-file-header"
									onClick={() => toggleFileExpansion(fileGroup.path)}
								>
									<div className="obsidian-file-header-content">
										<div className="obsidian-file-header-top">
											<div className="obsidian-file-header-left">
												{expandedFiles.has(fileGroup.path) ? (
													<ChevronDown size={16} className="obsidian-expand-icon" />
												) : (
													<ChevronRight size={16} className="obsidian-expand-icon" />
												)}
												<span className="obsidian-file-name">{fileGroup.fileName}</span>
											</div>
											<div className="obsidian-file-header-right">
																							<span className="obsidian-insight-count">
												{fileGroup.insights.length} {t('insights.progress.insightCountLabel')}
											</span>
											</div>
										</div>
										<div className="obsidian-file-path-row">
											<span className="obsidian-file-path">{fileGroup.path}</span>
											<div className="obsidian-insight-types">
												{Array.from(new Set(fileGroup.insights.map(insight => insight.insight_type)))
													.map(type => (
														<span key={type} className="obsidian-insight-type-tag">
															{getInsightTypeDisplayName(type)}
														</span>
													))
												}
											</div>
										</div>
									</div>
								</div>

								{/* 洞察列表 */}
								{expandedFiles.has(fileGroup.path) && (
									<div className="obsidian-file-blocks">
										{fileGroup.insights.map((insight, insightIndex) => (
											<div
												key={insight.id}
												className="obsidian-result-item"
												onClick={() => handleInsightClick(insight)}
											>
												<div className="obsidian-result-header">
													<div className="obsidian-result-header-left">
														<span className="obsidian-result-index">{insightIndex + 1}</span>
														<span className="obsidian-result-insight-type">
															{getInsightTypeDisplayName(insight.insight_type)}
														</span>
														<span className="obsidian-result-time">
															{insight.displayTime}
														</span>
													</div>
													<div className="obsidian-result-header-right">
														<button
															className="obsidian-delete-insight-btn"
															onClick={(e) => {
																e.stopPropagation()
																deleteSingleInsight(insight.id)
															}}
															disabled={deletingInsightId === insight.id}
															title={t('insights.tooltips.clear')}
														>
															{deletingInsightId === insight.id ? t('insights.deleting') : '🗑️'}
														</button>
													</div>
												</div>
												<div className="obsidian-result-content">
													<div className="obsidian-insight-content">
														{insight.insight}
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						))}
					</div>
				)}

				{!isLoading && hasLoaded && insightGroupedResults.length === 0 && (
					<div className="obsidian-no-results">
						<p>{t('insights.noResults.title')}</p>
						<p className="obsidian-no-results-hint">
							{t('insights.noResults.hint')}
						</p>
					</div>
				)}
			</div>

			{/* 样式 */}
			<style>
				{`
				.obsidian-insight-container {
					display: flex;
					flex-direction: column;
					height: 100%;
					font-family: var(--font-interface);
				}

				.obsidian-insight-header {
					padding: var(--size-4-3);
					border-bottom: 1px solid var(--background-modifier-border);
				}

				.obsidian-insight-title {
					display: flex;
					align-items: center;
					justify-content: space-between;
					margin-bottom: var(--size-4-2);
				}

				.obsidian-insight-title h3 {
					margin: 0;
					color: var(--text-normal);
					font-size: var(--font-ui-large);
					font-weight: 600;
				}

				.obsidian-insight-actions {
					display: flex;
					gap: var(--size-4-2);
				}

				.obsidian-insight-refresh-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					background-color: transparent !important;
					border: none !important;
					box-shadow: none !important;
					color: var(--text-muted);
					padding: 0 !important;
					margin: 0 !important;
					width: 24px !important;
					height: 24px !important;

					&:hover {
						background-color: var(--background-modifier-hover) !important;
					}
				}

				.obsidian-insight-refresh-btn:hover:not(:disabled) {
					background-color: var(--interactive-hover);
				}

				.obsidian-insight-refresh-btn:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}

				.infio-insight-stats {
					background-color: var(--background-secondary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: var(--size-4-2);
					display: flex;
					flex-direction: column;
					gap: var(--size-4-4);
				}

				.infio-insight-stats-overview {
					display: flex;
					align-items: center;
					justify-content: space-between;
				}

				.infio-insight-stats-main {
					display: flex;
					align-items: baseline;
					gap: var(--size-2-2);
				}

				.infio-insight-stats-number {
					font-size: var(--font-ui-large);
					font-weight: 700;
					color: var(--text-accent);
					font-family: var(--font-monospace);
				}

				.infio-insight-stats-label {
					font-size: var(--font-ui-medium);
					color: var(--text-normal);
					font-weight: var(--font-medium);
				}

				.infio-insight-stats-breakdown {
					flex: 1;
					display: flex;
					justify-content: flex-end;
				}

				.infio-insight-stats-items {
					display: flex;
					gap: var(--size-2-3);
				}

				.infio-insight-stats-item {
					display: flex;
					align-items: center;
					gap: var(--size-2-1);
					padding: var(--size-2-1) var(--size-2-2);
					background-color: var(--background-modifier-border);
					border-radius: var(--radius-s);
				}

				.infio-insight-stats-item-icon {
					font-size: var(--font-ui-smaller);
					line-height: 1;
				}

				.infio-insight-stats-item-value {
					font-size: var(--font-ui-small);
					font-weight: 600;
					color: var(--text-normal);
					font-family: var(--font-monospace);
				}

				.infio-insight-stats-item-label {
					font-size: var(--font-ui-smaller);
					color: var(--text-muted);
				}

				.infio-insight-model-info {
					display: flex;
					align-items: center;
					justify-content: space-between;
					gap: var(--size-4-3);
				}

				.infio-insight-model-row {
					display: flex;
					align-items: center;
					gap: var(--size-2-2);
					border: 1px solid var(--background-modifier-border);
					border-radius: 4px;
					padding: var(--size-2-2);
				}

				.infio-insight-model-label {
					font-size: var(--font-ui-small);
					color: var(--text-muted);
					font-weight: var(--font-medium);
				}

				.infio-insight-model-value {
					font-size: var(--font-ui-small);
					color: var(--text-accent);
					font-weight: 600;
					font-family: var(--font-monospace);
				}

				.infio-insight-actions {
					display: flex;
					gap: var(--size-2-2);
				}

				.infio-insight-primary-btn {
					padding: var(--size-2-2) var(--size-4-3);
					background-color: var(--interactive-accent-hover);
					border: none;
					border-radius: var(--radius-s);
					color: var(--text-muted);
					font-size: var(--font-ui-small);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					font-weight: var(--font-medium);
				}

				.infio-insight-primary-btn:hover:not(:disabled) {
					background-color: var(--interactive-accent-hover);
				}

				.infio-insight-primary-btn:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}

				.obsidian-insight-loading {
					padding: var(--size-4-8);
					text-align: center;
					color: var(--text-muted);
					font-size: var(--font-ui-medium);
				}

				.obsidian-insight-initializing {
					padding: var(--size-4-8);
					background-color: var(--background-secondary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					margin: var(--size-4-3);
				}

				.obsidian-insight-init-header {
					text-align: center;
					margin-bottom: var(--size-4-4);
				}

				.obsidian-insight-init-header h4 {
					margin: 0 0 var(--size-2-2) 0;
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					font-weight: 600;
				}

				.obsidian-insight-init-header p {
					margin: 0;
					color: var(--text-muted);
					font-size: var(--font-ui-small);
				}

				.obsidian-insight-progress {
					background-color: var(--background-primary);
					padding: var(--size-4-3);
					border-radius: var(--radius-s);
					border: 1px solid var(--background-modifier-border);
				}

				.obsidian-insight-progress-info {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: var(--size-2-2);
				}

				.obsidian-insight-progress-stage {
					color: var(--text-normal);
					font-size: var(--font-ui-small);
					font-weight: var(--font-medium);
				}

				.obsidian-insight-progress-counter {
					color: var(--text-muted);
					font-size: var(--font-ui-small);
					font-family: var(--font-monospace);
				}

				.obsidian-insight-progress-bar {
					width: 100%;
					height: 6px;
					background-color: var(--background-modifier-border);
					border-radius: 3px;
					overflow: hidden;
					margin-bottom: var(--size-2-2);
				}

				.obsidian-insight-progress-fill {
					height: 100%;
					background-color: var(--interactive-accent);
					border-radius: 3px;
					transition: width 0.3s ease;
				}

				.obsidian-insight-progress-details {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: var(--size-2-2);
				}

				.obsidian-insight-progress-item {
					color: var(--text-normal);
					font-size: var(--font-ui-small);
					font-weight: var(--font-medium);
					flex: 1;
					margin-right: var(--size-4-3);
				}

				.obsidian-insight-progress-percentage {
					color: var(--text-accent);
					font-size: var(--font-ui-small);
					font-weight: 600;
					font-family: var(--font-monospace);
					flex-shrink: 0;
				}

				.obsidian-insight-progress-log {
					margin-top: var(--size-2-2);
					padding: var(--size-2-2);
					background-color: var(--background-modifier-border-hover);
					border-radius: var(--radius-s);
					font-size: var(--font-ui-smaller);
				}

				.obsidian-insight-progress-log-item {
					display: flex;
					justify-content: space-between;
					margin-bottom: var(--size-2-1);
				}

				.obsidian-insight-progress-log-item:last-child {
					margin-bottom: 0;
				}

				.obsidian-insight-progress-log-label {
					color: var(--text-muted);
					font-weight: var(--font-medium);
					flex-shrink: 0;
					margin-right: var(--size-2-2);
				}

				.obsidian-insight-progress-log-value {
					color: var(--text-normal);
					font-family: var(--font-monospace);
					text-align: right;
					flex: 1;
					word-break: break-all;
				}

				.obsidian-insight-success {
					background-color: var(--background-secondary);
					border: 1px solid var(--color-green, #10b981);
					border-radius: var(--radius-s);
					margin: var(--size-4-3);
					animation: slideInFromTop 0.3s ease-out;
				}

				.obsidian-insight-success-content {
					display: flex;
					align-items: center;
					gap: var(--size-4-3);
					padding: var(--size-4-3) var(--size-4-4);
				}

				.obsidian-insight-success-icon {
					font-size: 16px;
					line-height: 1;
					color: var(--color-green, #10b981);
					flex-shrink: 0;
				}

				.obsidian-insight-success-text {
					display: flex;
					flex-direction: column;
					gap: var(--size-2-1);
					flex: 1;
					min-width: 0;
				}

				.obsidian-insight-success-title {
					font-size: var(--font-ui-medium);
					font-weight: 600;
					color: var(--text-normal);
					line-height: 1.3;
				}

				.obsidian-insight-success-close {
					background: none;
					border: none;
					color: var(--text-muted);
					font-size: 16px;
					font-weight: bold;
					cursor: pointer;
					padding: var(--size-2-1);
					border-radius: var(--radius-s);
					transition: all 0.15s ease-in-out;
					flex-shrink: 0;
					width: 24px;
					height: 24px;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.obsidian-insight-success-close:hover {
					background-color: var(--background-modifier-hover);
					color: var(--text-normal);
				}

				@keyframes slideInFromTop {
					0% {
						transform: translateY(-100%);
						opacity: 0;
					}
					100% {
						transform: translateY(0);
						opacity: 1;
					}
				}

				.obsidian-insight-results {
					flex: 1;
					overflow-y: auto;
				}

				.obsidian-results-list {
					display: flex;
					flex-direction: column;
				}

				.obsidian-file-group {
					border-bottom: 1px solid var(--background-modifier-border);
				}

				.obsidian-file-header {
					padding: var(--size-4-3);
					background-color: var(--background-secondary);
					cursor: pointer;
					transition: background-color 0.15s ease-in-out;
					border-bottom: 1px solid var(--background-modifier-border);
				}

				.obsidian-file-header:hover {
					background-color: var(--background-modifier-hover);
				}

				.obsidian-file-header-content {
					display: flex;
					flex-direction: column;
					gap: var(--size-2-1);
				}

				.obsidian-file-header-top {
					display: flex;
					align-items: center;
					justify-content: space-between;
				}

				.obsidian-file-header-left {
					display: flex;
					align-items: center;
					gap: var(--size-2-2);
					flex: 1;
					min-width: 0;
				}

				.obsidian-file-header-right {
					display: flex;
					align-items: center;
					gap: var(--size-2-2);
					flex-shrink: 0;
				}

				.obsidian-insight-count {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					background-color: var(--background-modifier-border);
					padding: var(--size-2-1) var(--size-2-2);
					border-radius: var(--radius-s);
					font-weight: var(--font-medium);
				}

				.obsidian-file-path-row {
					margin-left: 24px;
					display: flex;
					flex-direction: column;
					gap: var(--size-2-1);
				}

				.obsidian-insight-types {
					display: flex;
					flex-wrap: wrap;
					gap: var(--size-2-1);
					margin-top: var(--size-2-1);
				}

				.obsidian-insight-type-tag {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					background-color: var(--background-modifier-border-hover);
					padding: 1px var(--size-2-1);
					border-radius: var(--radius-s);
					font-weight: var(--font-medium);
				}

				.obsidian-expand-icon {
					color: var(--text-muted);
					flex-shrink: 0;
				}

				.obsidian-file-name {
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					font-weight: var(--font-medium);
					flex-shrink: 0;
					user-select: text;
					cursor: text;
				}

				.obsidian-file-path {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					font-family: var(--font-monospace);
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}

				.obsidian-file-blocks {
					background-color: var(--background-primary);
				}

				.obsidian-result-item {
					padding: var(--size-4-3) var(--size-4-3) var(--size-4-3) var(--size-4-8);
					border-bottom: 1px solid var(--background-modifier-border-focus);
					cursor: pointer;
					transition: background-color 0.15s ease-in-out;
				}

				.obsidian-result-item:hover {
					background-color: var(--background-modifier-hover);
				}

				.obsidian-result-item:last-child {
					border-bottom: none;
				}

				.obsidian-result-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					margin-bottom: var(--size-2-2);
					gap: var(--size-2-2);
				}

				.obsidian-result-header-left {
					display: flex;
					align-items: center;
					gap: var(--size-2-2);
					flex: 1;
					min-width: 0;
				}

				.obsidian-result-header-right {
					display: flex;
					align-items: center;
					flex-shrink: 0;
				}

				.obsidian-delete-insight-btn {
					padding: var(--size-2-1) var(--size-2-2);
					background-color: transparent;
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					display: flex;
					align-items: center;
					justify-content: center;
					min-width: 24px;
					height: 20px;
				}

				.obsidian-delete-insight-btn:hover:not(:disabled) {
					background-color: var(--text-error);
					border-color: var(--text-error);
					color: var(--text-on-accent);
				}

				.obsidian-delete-insight-btn:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}

				.obsidian-result-index {
					color: var(--text-muted);
					font-size: var(--font-ui-small);
					font-weight: var(--font-medium);
					min-width: 16px;
					flex-shrink: 0;
				}

				.obsidian-result-insight-type {
					color: var(--text-accent);
					font-size: var(--font-ui-smaller);
					font-weight: 600;
					background-color: var(--background-modifier-border);
					padding: var(--size-2-1) var(--size-2-2);
					border-radius: var(--radius-s);
					flex-grow: 1;
				}

				.obsidian-result-time {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					font-family: var(--font-monospace);
					flex-shrink: 0;
				}

				.obsidian-result-content {
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					line-height: 1.4;
					word-wrap: break-word;
					user-select: text;
					cursor: text;
				}

				.obsidian-insight-content {
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					line-height: 1.5;
					white-space: pre-wrap;
					user-select: text;
					cursor: text;
				}

				.obsidian-no-results {
					padding: var(--size-4-16) var(--size-4-8);
					text-align: center;
					color: var(--text-muted);
				}

				.obsidian-no-results p {
					margin: var(--size-2-2) 0;
					font-size: var(--font-ui-medium);
				}

				.obsidian-no-results-hint {
					font-size: var(--font-ui-small);
					color: var(--text-faint);
					font-style: italic;
				}

				.infio-insight-stats-page {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					margin-left: var(--size-2-2);
				}

				.infio-insight-pagination {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: var(--size-2-2);
					padding: var(--size-4-3);
					border-bottom: 1px solid var(--background-modifier-border);
				}

				.infio-insight-pagination-btn {
					background: var(--background-secondary);
					color: var(--text-normal);
					border: 1px solid var(--background-modifier-border);
					width: 32px;
					height: 32px;
					border-radius: var(--radius-s);
					font-size: var(--font-ui-medium);
					font-weight: bold;
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.infio-insight-pagination-btn:hover:not(:disabled) {
					background: var(--interactive-accent);
					color: var(--text-on-accent);
					border-color: var(--interactive-accent);
				}

				.infio-insight-pagination-btn:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.infio-insight-pagination-info {
					display: flex;
					align-items: center;
					gap: var(--size-2-1);
					margin: 0 var(--size-2-3);
				}

				.infio-insight-pagination-input {
					width: 50px;
					height: 28px;
					text-align: center;
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					background: var(--background-primary);
					color: var(--text-normal);
					font-size: var(--font-ui-small);
				}

				.infio-insight-pagination-total {
					color: var(--text-muted);
					font-size: var(--font-ui-small);
				}

				/* 确认对话框样式 */
				.obsidian-confirm-dialog-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background-color: rgba(0, 0, 0, 0.5);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 1000;
				}

				.obsidian-confirm-dialog {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-l);
					box-shadow: var(--shadow-l);
					max-width: 400px;
					width: 90%;
					max-height: 80vh;
					overflow: hidden;
				}

				.obsidian-confirm-dialog-header {
					padding: var(--size-4-4) var(--size-4-8);
					border-bottom: 1px solid var(--background-modifier-border);
					background-color: var(--background-secondary);
				}

				.obsidian-confirm-dialog-header h3 {
					margin: 0;
					color: var(--text-normal);
					font-size: var(--font-ui-large);
					font-weight: 600;
				}

				.obsidian-confirm-dialog-body {
					padding: var(--size-4-8);
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					line-height: 1.5;
				}

				.obsidian-confirm-dialog-body p {
					margin: 0 0 var(--size-4-3) 0;
				}

				.obsidian-confirm-dialog-warning {
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: var(--size-4-3);
					margin: var(--size-4-3) 0;
					color: var(--text-error);
					font-size: var(--font-ui-small);
					font-weight: var(--font-medium);
				}

				.obsidian-confirm-dialog-scope {
					background-color: var(--background-secondary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: var(--size-2-2) var(--size-4-3);
					margin: var(--size-4-3) 0 0 0;
					font-size: var(--font-ui-small);
					color: var(--text-muted);
				}

				.obsidian-confirm-dialog-info {
					background-color: var(--background-secondary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: var(--size-4-3);
					margin: var(--size-4-3) 0;
				}

				.obsidian-confirm-dialog-info-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: var(--size-2-2);
					font-size: var(--font-ui-small);
				}

				.obsidian-confirm-dialog-info-item:last-child {
					margin-bottom: 0;
				}

				.obsidian-confirm-dialog-info-item strong {
					color: var(--text-normal);
					margin-right: var(--size-4-3);
					flex-shrink: 0;
				}

				.obsidian-confirm-dialog-model,
				.obsidian-confirm-dialog-workspace {
					color: var(--text-accent);
					font-weight: 600;
					font-family: var(--font-monospace);
					text-align: right;
					flex: 1;
					word-break: break-all;
				}

				.obsidian-confirm-dialog-footer {
					padding: var(--size-4-4) var(--size-4-8);
					border-top: 1px solid var(--background-modifier-border);
					background-color: var(--background-secondary);
					display: flex;
					justify-content: flex-end;
					gap: var(--size-4-3);
				}

				.obsidian-confirm-dialog-cancel-btn {
					padding: var(--size-2-2) var(--size-4-4);
					background-color: var(--interactive-normal);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					font-size: var(--font-ui-small);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					font-weight: var(--font-medium);
				}

				.obsidian-confirm-dialog-cancel-btn:hover {
					background-color: var(--interactive-hover);
				}

				.obsidian-confirm-dialog-confirm-btn {
					padding: var(--size-2-2) var(--size-4-4);
					background-color: var(--text-error);
					border: 1px solid var(--text-error);
					border-radius: var(--radius-s);
					color: var(--text-on-accent);
					font-size: var(--font-ui-small);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					font-weight: var(--font-medium);
				}

				.obsidian-confirm-dialog-confirm-btn:hover {
					background-color: var(--text-error);
					opacity: 0.8;
				}
				`}
			</style>
		</div>
	)
}

export default InsightView 
