import 'katex/dist/katex.min.css'
import { useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'

import { useDarkModeContext } from '../../../contexts/DarkModeContext'

import { MemoizedMermaidBlock } from './MermaidBlock'
import { MemoizedSyntaxHighlighterWrapper } from './SyntaxHighlighterWrapper'

interface RawMarkdownBlockProps {
	content: string
	className?: string
}

export default function RawMarkdownBlock({
	content,
	className = "infio-markdown",
}: RawMarkdownBlockProps) {
	const { isDarkMode } = useDarkModeContext()
	const containerRef = useRef<HTMLDivElement>(null)

	// 配置 rehype-katex 选项
	const katexOptions = {
		throwOnError: false,
		errorColor: isDarkMode ? '#ff6b6b' : '#cc0000'
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
	}, [content])

	return (
		<div ref={containerRef}>
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
					
					// 优化表格内的链接渲染
					a({ href, children, ...props }) {
						return (
							<a 
								href={href}
								target="_blank"
								rel="noopener noreferrer"
								className="infio-markdown-link"
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
				{content}
			</ReactMarkdown>
			

		</div>
	)
}
