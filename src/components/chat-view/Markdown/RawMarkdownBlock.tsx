import * as Tooltip from '@radix-ui/react-tooltip'
import 'katex/dist/katex.min.css'
import { Check, CopyIcon, FilePlus2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { useApp } from '../../../contexts/AppContext'
import { useDarkModeContext } from '../../../contexts/DarkModeContext'
import { t } from '../../../lang/helpers'
import { openMarkdownFile } from '../../../utils/obsidian'

import { MemoizedMermaidBlock } from './MermaidBlock'
import { MemoizedSyntaxHighlighterWrapper } from './SyntaxHighlighterWrapper'

// CopyButton component integrated into RawMarkdownBlock
function CopyButton({ message }: { message: string }) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		await navigator.clipboard.writeText(message)
		setCopied(true)
		setTimeout(() => {
			setCopied(false)
		}, 1500)
	}

	return (
		<Tooltip.Provider delayDuration={0}>
			<Tooltip.Root>
				<Tooltip.Trigger asChild>
					<button className="infio-markdown-action-button">
						{copied ? (
							<Check
								size={12}
								className="infio-chat-message-actions-icon--copied"
							/>
						) : (
							<CopyIcon onClick={handleCopy} size={12} />
						)}
					</button>
				</Tooltip.Trigger>
				<Tooltip.Portal>
					<Tooltip.Content className="infio-tooltip-content">
						{t('chat.reactMarkdown.copyMsg')}
					</Tooltip.Content>
				</Tooltip.Portal>
			</Tooltip.Root>
		</Tooltip.Provider>
	)
}

// CreateNewFileButton component integrated into RawMarkdownBlock  
function CreateNewFileButton({ message }: { message: string }) {
	const app = useApp()
	const [created, setCreated] = useState(false)

	const cleanMarkdownTitle = (text: string): string => {
		// 移除所有 # 开头的标题标记
		return text.replace(/^#+\s*/g, '');
	}

	const handleCreate = async () => {
		const firstLine = cleanMarkdownTitle(message.trimStart().split('\n')[0].trim()).replace(/[\\/:]/g, '');
		const filename = firstLine.slice(0, 200) + (firstLine.length > 200 ? '...' : '') || 'untitled';
		await app.vault.create(`/${filename}.md`, message)
		await app.workspace.openLinkText(filename, 'split', true)
		setCreated(true)
		setTimeout(() => {
			setCreated(false)
		}, 1500)
	}
	return (
		<Tooltip.Provider delayDuration={0}>
			<Tooltip.Root>
				<Tooltip.Trigger asChild>
					<button className="infio-markdown-action-button infio-markdown-create-button">
						{created ? (
							<Check
								size={12}
								className="infio-chat-message-actions-icon--copied"
							/>
						) : (
							<FilePlus2 onClick={handleCreate} size={12} />
						)}
					</button>
				</Tooltip.Trigger>
				<Tooltip.Portal>
					<Tooltip.Content className="infio-tooltip-content">
						{t('chat.reactMarkdown.createNewNote')}
					</Tooltip.Content>
				</Tooltip.Portal>
			</Tooltip.Root>
		</Tooltip.Provider>
	)
}

interface RawMarkdownBlockProps {
	content: string
	className?: string
}

export default function RawMarkdownBlock({
	content,
	className = "infio-markdown",
}: RawMarkdownBlockProps) {
	const app = useApp()
	const { isDarkMode } = useDarkModeContext()
	const containerRef = useRef<HTMLDivElement>(null)

	// URL编码处理函数
	const encodeUrlForMarkdown = (url: string): string => {
		// 对URL进行编码，特别处理空格、问号等特殊字符
		return url
			.replace(/ /g, '%20')   // 空格编码为%20
			.replace(/\?/g, '%3F')  // 问号编码为%3F
			.replace(/#/g, '%23')   // 井号编码为%23
			.replace(/&/g, '%26')   // &符号编码为%26
			.replace(/\[/g, '%5B')  // 方括号编码
			.replace(/\]/g, '%5D')
	}

	// 预处理Markdown内容，修复链接中的特殊字符
	const preprocessMarkdownContent = (markdownContent: string): string => {
		if (!markdownContent ||markdownContent.trim() === "") {
			return markdownContent
		}
		// 匹配所有Markdown链接格式 [text](url)
		return markdownContent.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, linkUrl) => {
			// 检查URL是否需要编码（包含特殊字符但不是已编码的URL）
			if ((linkUrl.includes(' ') || linkUrl.includes('?') || linkUrl.includes('#') || linkUrl.includes('&')) && 
				!linkUrl.includes('%20') && !linkUrl.includes('%3F') && !linkUrl.includes('%23') && !linkUrl.includes('%26')) {
				const encodedUrl = encodeUrlForMarkdown(linkUrl)
				// console.debug('🔧 [RawMarkdownBlock] 编码URL:', {
				// 	original: linkUrl,
				// 	encoded: encodedUrl
				// })
				return `[${linkText}](${encodedUrl})`
			}
			return match
		})
	}

	// 预处理内容
	const processedContent = preprocessMarkdownContent(content)

	// 配置 rehype-katex 选项
	const katexOptions = {
		throwOnError: false,
		errorColor: isDarkMode ? '#ff6b6b' : '#cc0000'
	}

	// 判断链接是否为内部文件链接
	const isInternalFileLink = (href: string): boolean => {
		if (!href) return false
		
		// 排除外部链接
		if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('mailto:') || href.startsWith('tel:')) {
			return false
		}
		
		// 处理可能包含行号的路径 (格式: path:lineNumber)
		let pathToCheck = href
		const colonIndex = href.lastIndexOf(':')
		if (colonIndex !== -1) {
			const potentialLineNumber = href.substring(colonIndex + 1)
			// 如果冒号后面是数字，则认为是行号，去掉行号部分
			if (/^\d+$/.test(potentialLineNumber)) {
				pathToCheck = href.substring(0, colonIndex)
			}
		}
		
		// 检查是否为文件路径（相对路径或绝对路径）
		// 支持常见的文件扩展名
		const fileExtensions = ['.md', '.txt', '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']
		const hasFileExtension = fileExtensions.some(ext => pathToCheck.toLowerCase().endsWith(ext))
		
		// 如果有文件扩展名，或者看起来像文件路径（包含斜杠但不是URL），则认为是内部链接
		return hasFileExtension || 
			   (pathToCheck.includes('/') && !pathToCheck.includes('://')) ||
			   pathToCheck.startsWith('./') ||
			   pathToCheck.startsWith('../') ||
			   (!pathToCheck.includes('.') && !pathToCheck.includes(':')) // 可能是不带扩展名的文件名
	}

	// 处理链接点击
	const handleLinkClick = (e: React.MouseEvent, href: string) => {
		if (isInternalFileLink(href)) {
			e.preventDefault()
			
			// 解码URL编码的路径
			const decodedHref = decodeURIComponent(href)
			
			// 检查是否包含行号 (格式: path:lineNumber)
			const colonIndex = decodedHref.lastIndexOf(':')
			let filePath = decodedHref
			let lineNumber: number | undefined
			
			if (colonIndex !== -1) {
				const potentialLineNumber = decodedHref.substring(colonIndex + 1)
				// 检查冒号后面是否为数字
				if (/^\d+$/.test(potentialLineNumber)) {
					filePath = decodedHref.substring(0, colonIndex)
					lineNumber = parseInt(potentialLineNumber, 10)
				}
			}
			
			console.debug('🔍 [RawMarkdownBlock] 尝试打开文件:', {
				originalHref: href,
				decodedHref,
				filePath,
				lineNumber
			})
			
			// 首先尝试直接使用解码后的路径
			let foundFile = app.vault.getFileByPath(filePath)
			
			if (!foundFile) {
				// 如果直接路径找不到，尝试在vault中搜索
				foundFile = app.vault.getFiles().find(f => 
					f.name === filePath || 
					f.path === filePath ||
					f.path.endsWith('/' + filePath) ||
					f.basename === filePath.replace(/\.[^/.]+$/, '') // 去掉扩展名比较
				)
			}
			
			if (foundFile) {
				console.debug('✅ [RawMarkdownBlock] 找到文件:', foundFile.path)
				try {
					// 如果有行号，传递给openMarkdownFile函数
					if (lineNumber !== undefined) {
						openMarkdownFile(app, foundFile.path, lineNumber)
					} else {
						openMarkdownFile(app, foundFile.path)
					}
				} catch (error) {
					console.error('❌ [RawMarkdownBlock] 打开文件失败:', error)
					// 如果打开失败，让浏览器处理链接
					window.open(href, '_blank')
				}
			} else {
				console.warn('⚠️ [RawMarkdownBlock] 未找到文件:', filePath)
				// 如果找不到文件，让浏览器处理链接
				window.open(href, '_blank')
			}
		}
		// 对于外部链接，让默认行为处理
	}

	// 处理复制事件，使用原始 markdown 格式
	useEffect(() => {
		const handleCopy = (e: ClipboardEvent) => {
			if (!containerRef.current) return
			
			const selection = window.getSelection()
			if (!selection || selection.rangeCount === 0) return

			const range = selection.getRangeAt(0)
			const container = range.commonAncestorContainer
			
			// 检查是否包含 KaTeX 元素
			const parentElement = container.nodeType === Node.TEXT_NODE 
				? container.parentElement 
				: (container instanceof HTMLElement ? container : null)
			
			if (!parentElement || !containerRef.current.contains(parentElement)) return

			// 查找选择范围内的所有 KaTeX 元素
			const katexElements = containerRef.current.querySelectorAll('.katex')
			if (katexElements.length === 0) return

			// 创建一个临时容器来处理复制内容
			const tempContainer = document.createElement('div')
			const clonedContent = range.cloneContents()
			tempContainer.appendChild(clonedContent)

			// 替换所有 KaTeX 元素的内容为原始 markdown 格式
			const clonedKatexElements = tempContainer.querySelectorAll('.katex')
			clonedKatexElements.forEach((katexEl) => {
				// 找到对应的原始元素
				const originalKatex = Array.from(katexElements).find(original => {
					const originalMathML = original.querySelector('.katex-mathml')
					const clonedMathML = katexEl.querySelector('.katex-mathml')
					return originalMathML && clonedMathML && 
						originalMathML.textContent === clonedMathML.textContent
				})

				if (originalKatex) {
					// 尝试从 MathML 中提取原始的 LaTeX 代码
					const mathmlEl = originalKatex.querySelector('math')
					if (mathmlEl) {
						// 检查是否为 display 模式（块级公式）
						const isDisplayMode = originalKatex.closest('.katex-display') !== null
						
						// 从 MathML 中提取 LaTeX 代码
						// 这里我们需要从 annotation 元素中获取原始的 LaTeX
						const annotationEl = mathmlEl.querySelector('annotation[encoding="application/x-tex"]')
						if (annotationEl && annotationEl.textContent) {
							const latexCode = annotationEl.textContent
							// 根据是否为 display 模式添加相应的包装符号
							const markdownText = isDisplayMode ? `$$${latexCode}$$` : `$${latexCode}$`
							katexEl.textContent = markdownText
						} else {
							// 如果没有找到 annotation，尝试从其他地方获取
							// 或者使用一个简单的文本替换
							const mathText = mathmlEl.textContent || ''
							const isDisplayMode = originalKatex.closest('.katex-display') !== null
							const markdownText = isDisplayMode ? `$$${mathText}$$` : `$${mathText}$`
							katexEl.textContent = markdownText
						}
					}
				}
			})

			// 更新剪贴板
			const modifiedText = tempContainer.textContent || tempContainer.innerText || ''
			
			if (e.clipboardData) {
				e.clipboardData.setData('text/plain', modifiedText)
				e.preventDefault()
			}
		}

		const container = containerRef.current
		if (container) {
			container.addEventListener('copy', handleCopy)
			return () => {
				container.removeEventListener('copy', handleCopy)
			}
		}
	}, [processedContent])

	return (
		<div 
			ref={containerRef} 
			className="infio-markdown-container-with-actions"
		>
			<ReactMarkdown
				className={className}
				remarkPlugins={[remarkMath, remarkGfm]}
				rehypePlugins={[[rehypeKatex, katexOptions]]}
				components={{
					// 表格渲染优化
					table({ children, ...props }) {
						return (
							<div className="infio-markdown-table-container">
								<table className="infio-markdown-table" {...props}>
									{children}
								</table>
							</div>
						)
					},
					thead({ children, ...props }) {
						return (
							<thead className="infio-markdown-table-head" {...props}>
								{children}
							</thead>
						)
					},
					tbody({ children, ...props }) {
						return (
							<tbody className="infio-markdown-table-body" {...props}>
								{children}
							</tbody>
						)
					},
					tr({ children, ...props }) {
						return (
							<tr className="infio-markdown-table-row" {...props}>
								{children}
							</tr>
						)
					},
					th({ children, ...props }) {
						return (
							<th className="infio-markdown-table-header" {...props}>
								{children}
							</th>
						)
					},
					td({ children, ...props }) {
						return (
							<td className="infio-markdown-table-cell" {...props}>
								{children}
							</td>
						)
					},
					
					// 优化链接渲染
					a({ href, children, ...props }) {
						const isInternal = isInternalFileLink(href || '')
						
						return (
							<a 
								href={href}
								target={isInternal ? undefined : "_blank"}
								rel={isInternal ? undefined : "noopener noreferrer"}
								className={`infio-markdown-link ${isInternal ? 'infio-markdown-link--internal' : 'infio-markdown-link--external'}`}
								onClick={(e) => handleLinkClick(e, href || '')}
								{...props}
							>
								{children}
							</a>
						)
					},
					
					// 代码块渲染
					code({ className, children, ...props }) {
						const match = /language-(\w+)/.exec(className || '')
						const language = match ? match[1] : undefined
						const isInline = !className
						
						// Mermaid 图表渲染
						if (!isInline && language === 'mermaid') {
							const codeText = String(children || "")
							return (
								<MemoizedMermaidBlock
									code={codeText}
								/>
							)
						}
						
						// 代码块使用语法高亮
						if (!isInline && language) {
							return (
								<MemoizedSyntaxHighlighterWrapper
									isDarkMode={isDarkMode}
									language={language}
									hasFilename={false}
									wrapLines={true}
								>
									{String(children).replace(/\n$/, '')}
								</MemoizedSyntaxHighlighterWrapper>
							)
						}
						
						// 内联代码使用原生样式
						return <code {...props}>{children}</code>
					},
				}}
			>
				{processedContent}
			</ReactMarkdown>
			
			{/* Action buttons - only show on hover and if content exists */}
			{content && content.trim().length > 0 && (
				<div className="infio-markdown-actions">
					<CopyButton message={content} />
					<CreateNewFileButton message={content} />
				</div>
			)}
		</div>
	)
}
