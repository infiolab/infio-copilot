import { SerializedEditorState } from 'lexical'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

import { useApp } from '../../contexts/AppContext'
import { useRAG } from '../../contexts/RAGContext'
import { SelectVector } from '../../database/schema'
import { Mentionable } from '../../types/mentionable'
import { openMarkdownFile } from '../../utils/obsidian'

import SearchInputWithActions, { SearchInputRef } from './chat-input/SearchInputWithActions'
import { editorStateToPlainText } from './chat-input/utils/editor-state-to-plain-text'

// 文件分组结果接口
interface FileGroup {
	path: string
	fileName: string
	maxSimilarity: number
	blocks: (Omit<SelectVector, 'embedding'> & { similarity: number })[]
}

const SearchView = () => {
	const { getRAGEngine } = useRAG()
	const app = useApp()
	const searchInputRef = useRef<SearchInputRef>(null)
	const [searchResults, setSearchResults] = useState<(Omit<SelectVector, 'embedding'> & { similarity: number })[]>([])
	const [isSearching, setIsSearching] = useState(false)
	const [hasSearched, setHasSearched] = useState(false)
	// 展开状态管理 - 默认全部展开
	const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set())
	// 新增：mentionables 状态管理
	const [mentionables, setMentionables] = useState<Mentionable[]>([])
	const [searchEditorState, setSearchEditorState] = useState<SerializedEditorState | null>(null)

	const handleSearch = useCallback(async (editorState?: SerializedEditorState) => {
		let searchTerm = ''
		
		if (editorState) {
			// 使用成熟的函数从 Lexical 编辑器状态中提取文本内容
			searchTerm = editorStateToPlainText(editorState).trim()
		}
		
		if (!searchTerm.trim()) {
			setSearchResults([])
			setHasSearched(false)
			return
		}
		
		setIsSearching(true)
		setHasSearched(true)
		
		try {
			const ragEngine = await getRAGEngine()
			const results = await ragEngine.processQuery({
				query: searchTerm,
				limit: 50, // 使用用户选择的限制数量
			})
			
			setSearchResults(results)
			// 默认展开所有文件
			// const uniquePaths = new Set(results.map(r => r.path))
			// setExpandedFiles(new Set(uniquePaths))
		} catch (error) {
			console.error('搜索失败:', error)
			setSearchResults([])
		} finally {
			setIsSearching(false)
		}
	}, [getRAGEngine])

	const handleResultClick = (result: Omit<SelectVector, 'embedding'> & { similarity: number }) => {
		openMarkdownFile(app, result.path, result.metadata.startLine)
	}

	const toggleFileExpansion = (filePath: string) => {
		const newExpandedFiles = new Set(expandedFiles)
		if (newExpandedFiles.has(filePath)) {
			newExpandedFiles.delete(filePath)
		} else {
			newExpandedFiles.add(filePath)
		}
		setExpandedFiles(newExpandedFiles)
	}

	// 限制文本显示行数
	const truncateContent = (content: string, maxLines: number = 3) => {
		const lines = content.split('\n')
		if (lines.length <= maxLines) {
			return content
		}
		return lines.slice(0, maxLines).join('\n') + '...'
	}

	// 渲染markdown内容
	const renderMarkdownContent = (content: string, maxLines: number = 3) => {
		const truncatedContent = truncateContent(content, maxLines)
		return (
			<ReactMarkdown
				className="obsidian-markdown-content"
				components={{
					// 简化渲染，移除一些复杂元素
					h1: ({ children }) => <h4>{children}</h4>,
					h2: ({ children }) => <h4>{children}</h4>,
					h3: ({ children }) => <h4>{children}</h4>,
					h4: ({ children }) => <h4>{children}</h4>,
					h5: ({ children }) => <h5>{children}</h5>,
					h6: ({ children }) => <h5>{children}</h5>,
					// 移除图片显示，避免布局问题
					img: () => <span className="obsidian-image-placeholder">[图片]</span>,
					// 代码块样式
					code: ({ children, inline, ...props }: { children: React.ReactNode; inline?: boolean; [key: string]: unknown }) => {
						if (inline) {
							return <code className="obsidian-inline-code">{children}</code>
						}
						return <pre className="obsidian-code-block"><code>{children}</code></pre>
					},
					// 链接样式
					a: ({ href, children }) => (
						<span className="obsidian-link" title={href}>{children}</span>
					),
				}}
			>
				{truncatedContent}
			</ReactMarkdown>
		)
	}

	// 按文件分组并排序
	const groupedResults = useMemo(() => {
		if (!searchResults.length) return []

		// 按文件路径分组
		const fileGroups = new Map<string, FileGroup>()
		
		searchResults.forEach(result => {
			const filePath = result.path
			const fileName = filePath.split('/').pop() || filePath
			
			if (!fileGroups.has(filePath)) {
				fileGroups.set(filePath, {
					path: filePath,
					fileName,
					maxSimilarity: result.similarity,
					blocks: []
				})
			}
			
			const group = fileGroups.get(filePath)
			if (group) {
				group.blocks.push(result)
				// 更新最高相似度
				if (result.similarity > group.maxSimilarity) {
					group.maxSimilarity = result.similarity
				}
			}
		})

		// 对每个文件内的块按相似度排序
		fileGroups.forEach(group => {
			group.blocks.sort((a, b) => b.similarity - a.similarity)
		})

		// 将文件按最高相似度排序
		return Array.from(fileGroups.values()).sort((a, b) => b.maxSimilarity - a.maxSimilarity)
	}, [searchResults])

	const totalBlocks = searchResults.length
	const totalFiles = groupedResults.length

	return (
		<div className="obsidian-search-container">
			{/* 搜索输入框 */}
			<div className="obsidian-search-header">
				<SearchInputWithActions
					ref={searchInputRef}
					initialSerializedEditorState={searchEditorState}
					onChange={setSearchEditorState}
					onSubmit={handleSearch}
					mentionables={mentionables}
					setMentionables={setMentionables}
					placeholder="语义搜索（按回车键搜索）..."
					autoFocus={true}
					disabled={isSearching}
				/>
			</div>

			{/* 结果统计 */}
			{hasSearched && !isSearching && (
				<div className="obsidian-search-stats">
					{totalFiles} 个文件，{totalBlocks} 个块
				</div>
			)}

			{/* 搜索进度 */}
			{isSearching && (
				<div className="obsidian-search-loading">
					正在搜索...
				</div>
			)}

			{/* 搜索结果 */}
			<div className="obsidian-search-results">
				{!isSearching && groupedResults.length > 0 && (
					<div className="obsidian-results-list">
						{groupedResults.map((fileGroup, fileIndex) => (
							<div key={fileGroup.path} className="obsidian-file-group">
								{/* 文件头部 */}
								<div 
									className="obsidian-file-header"
									onClick={() => toggleFileExpansion(fileGroup.path)}
								>
									<div className="obsidian-file-header-left">
										{expandedFiles.has(fileGroup.path) ? (
											<ChevronDown size={16} className="obsidian-expand-icon" />
										) : (
											<ChevronRight size={16} className="obsidian-expand-icon" />
										)}
										{/* <span className="obsidian-file-index">{fileIndex + 1}</span> */}
										<span className="obsidian-file-name">{fileGroup.fileName}</span>
										{/* <span className="obsidian-file-path">({fileGroup.path})</span> */}
									</div>
									<div className="obsidian-file-header-right">
										{/* <span className="obsidian-file-blocks">{fileGroup.blocks.length} 块</span> */}
										{/* <span className="obsidian-file-similarity">
											{fileGroup.maxSimilarity.toFixed(3)}
										</span> */}
									</div>
								</div>

								{/* 文件块列表 */}
								{expandedFiles.has(fileGroup.path) && (
									<div className="obsidian-file-blocks">
										{fileGroup.blocks.map((result, blockIndex) => (
											<div
												key={result.id}
												className="obsidian-result-item"
												onClick={() => handleResultClick(result)}
											>
												<div className="obsidian-result-header">
													<span className="obsidian-result-index">{blockIndex + 1}</span>
													<span className="obsidian-result-location">
														L{result.metadata.startLine}-{result.metadata.endLine}
													</span>
													<span className="obsidian-result-similarity">
														{result.similarity.toFixed(3)}
													</span>
												</div>
												<div className="obsidian-result-content">
													{renderMarkdownContent(result.content)}
												</div>
											</div>
										))}
									</div>
								)}
							</div>
						))}
					</div>
				)}
				
				{!isSearching && hasSearched && groupedResults.length === 0 && (
					<div className="obsidian-no-results">
						<p>未找到相关结果</p>
					</div>
				)}
			</div>

			{/* 样式 */}
			<style>
				{`
				.obsidian-search-container {
					display: flex;
					flex-direction: column;
					height: 100%;
					font-family: var(--font-interface);
				}

				.obsidian-search-header {
					padding: 12px;
				}

				.obsidian-search-stats {
					padding: 8px 12px;
					font-size: var(--font-ui-small);
					color: var(--text-muted);
				}

				.obsidian-search-loading {
					padding: 20px;
					text-align: center;
					color: var(--text-muted);
					font-size: var(--font-ui-medium);
				}

				.obsidian-search-results {
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
					padding: 12px;
					background-color: var(--background-secondary);
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: space-between;
					transition: background-color 0.1s ease;
					border-bottom: 1px solid var(--background-modifier-border);
				}

				.obsidian-file-header:hover {
					background-color: var(--background-modifier-hover);
				}

				.obsidian-file-header-left {
					display: flex;
					align-items: center;
					gap: 8px;
					flex: 1;
					min-width: 0;
				}

				.obsidian-file-header-right {
					display: flex;
					align-items: center;
					gap: 12px;
					flex-shrink: 0;
				}

				.obsidian-expand-icon {
					color: var(--text-muted);
					flex-shrink: 0;
				}

				.obsidian-file-index {
					color: var(--text-muted);
					font-size: var(--font-ui-small);
					font-weight: 500;
					min-width: 20px;
					flex-shrink: 0;
				}

				.obsidian-file-name {
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					font-weight: 500;
					flex-shrink: 0;
				}

				.obsidian-file-path {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					font-family: var(--font-monospace);
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
					margin-left: 4px;
				}

				.obsidian-file-blocks {
					color: var(--text-muted);
					font-size: var(--font-ui-small);
				}

				.obsidian-file-similarity {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					font-family: var(--font-monospace);
				}

				.obsidian-file-blocks {
					background-color: var(--background-primary);
				}

				.obsidian-result-item {
					padding: 12px 12px 12px 32px;
					border-bottom: 1px solid var(--background-modifier-border-focus);
					cursor: pointer;
					transition: background-color 0.1s ease;
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
					margin-bottom: 6px;
					gap: 8px;
				}

				.obsidian-result-index {
					color: var(--text-muted);
					font-size: var(--font-ui-small);
					font-weight: 500;
					min-width: 16px;
					flex-shrink: 0;
				}

				.obsidian-result-location {
					color: var(--text-muted);
					font-size: var(--font-ui-smaller);
					font-family: var(--font-monospace);
					flex-grow: 1;
				}

				.obsidian-result-similarity {
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
				}

				/* Markdown 渲染样式 */
				.obsidian-markdown-content {
					color: var(--text-normal);
					font-size: var(--font-ui-medium);
					line-height: 1.4;
				}

				.obsidian-markdown-content h4,
				.obsidian-markdown-content h5 {
					margin: 4px 0;
					color: var(--text-normal);
					font-weight: 600;
				}

				.obsidian-markdown-content p {
					margin: 4px 0;
				}

				.obsidian-markdown-content ul,
				.obsidian-markdown-content ol {
					margin: 4px 0;
					padding-left: 16px;
				}

				.obsidian-markdown-content li {
					margin: 2px 0;
				}

				.obsidian-inline-code {
					background-color: var(--background-modifier-border);
					color: var(--text-accent);
					padding: 2px 4px;
					border-radius: var(--radius-s);
					font-family: var(--font-monospace);
					font-size: 0.9em;
				}

				.obsidian-code-block {
					background-color: var(--background-modifier-border);
					padding: 8px;
					border-radius: var(--radius-s);
					margin: 4px 0;
					overflow-x: auto;
				}

				.obsidian-code-block code {
					font-family: var(--font-monospace);
					font-size: var(--font-ui-smaller);
					color: var(--text-normal);
				}

				.obsidian-link {
					color: var(--text-accent);
					text-decoration: underline;
					cursor: pointer;
				}

				.obsidian-image-placeholder {
					color: var(--text-muted);
					font-style: italic;
					background-color: var(--background-modifier-border);
					padding: 2px 6px;
					border-radius: var(--radius-s);
					font-size: var(--font-ui-smaller);
				}

				.obsidian-markdown-content blockquote {
					border-left: 3px solid var(--text-accent);
					padding-left: 12px;
					margin: 4px 0;
					color: var(--text-muted);
					font-style: italic;
				}

				.obsidian-markdown-content strong {
					font-weight: 600;
					color: var(--text-normal);
				}

				.obsidian-markdown-content em {
					font-style: italic;
					color: var(--text-muted);
				}

				.obsidian-no-results {
					padding: 40px 20px;
					text-align: center;
					color: var(--text-muted);
				}

				.obsidian-no-results p {
					margin: 0;
					font-size: var(--font-ui-medium);
				}
				`}
			</style>
		</div>
	)
}

export default SearchView 

