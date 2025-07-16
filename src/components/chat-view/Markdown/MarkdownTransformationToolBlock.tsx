import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react'
import React, { useState } from 'react'

import { useApp } from "../../../contexts/AppContext"
import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { TransformationType } from "../../../core/transformations/trans-engine"
import { ApplyStatus, ToolArgs } from "../../../types/apply"
import { openMarkdownFile } from "../../../utils/obsidian"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export type TransformationToolType = 'call_transformations'

interface MarkdownTransformationToolBlockProps {
	applyStatus: ApplyStatus
	onApply: (args: ToolArgs) => void
	toolType: TransformationToolType
	path: string
	transformation?: string
	finish: boolean
	toolExecutionResult?: {
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}
}

const getTransformationConfig = (transformation: string) => {
	switch (transformation) {
		case 'analyze_paper':
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Analyze Paper',
				description: 'Deep analysis of academic papers'
			}
		case 'key_insights':
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Key Insights',
				description: 'Extract key insights'
			}
		case 'dense_summary':
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Dense Summary',
				description: 'Create information-dense summary'
			}
		case 'reflections':
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Deep Reflections',
				description: 'Generate deep reflections'
			}
		case 'table_of_contents':
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Table of Contents',
				description: 'Generate table of contents structure'
			}
		case 'hierarchical_summary':
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Hierarchical Summary',
				description: 'Create hierarchical summary'
			}
		case 'simple_summary':
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Simple Summary',
				description: 'Create simple summary'
			}
		default:
			return {
				icon: <Sparkles size={14} className="infio-chat-code-block-header-icon" />,
				title: 'Document Processing',
				description: 'Process document'
			}
	}
}

export default function MarkdownTransformationToolBlock({
	applyStatus,
	onApply,
	path,
	transformation,
	finish,
	toolExecutionResult
}: MarkdownTransformationToolBlockProps) {
	const app = useApp()
	const { isDarkMode } = useDarkModeContext()
	const config = getTransformationConfig(transformation || '')
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	const handleClick = () => {
		if (path) {
			openMarkdownFile(app, path)
		}
	}

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle && transformation) {
			// 验证transformation是否为有效的TransformationType
			const validTransformationTypes = Object.values(TransformationType);
			if (validTransformationTypes.includes(transformation as TransformationType)) {
				onApply({
					type: 'call_transformations',
					path: path || '',
					transformation: transformation as TransformationType
				})
			}
		}
	}, [finish])

	const getDisplayText = () => {
		return `${config.title}: ${path || '未指定路径'}`
	}

	return (
		<div>
			<div
				className={`infio-chat-code-block infio-transformation-tool-block ${path ? 'has-filename' : ''}`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<div className={'infio-chat-code-block-header'}>
					<div 
						className={'infio-chat-code-block-header-filename'}
						onClick={(e) => {
							if (toolExecutionResult && isHovered) {
								e.stopPropagation()
								setIsResultOpen(!isResultOpen)
							} else {
								handleClick()
							}
						}}
					>
						{toolExecutionResult && isHovered ? (
							isResultOpen ? <ChevronDown size={14} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={14} className="infio-chat-code-block-header-icon" />
						) : (
							config.icon
						)}
						<span>{getDisplayText()}</span>
					</div>
				</div>
			</div>
			{/* 工具执行结果显示区域 */}
			{toolExecutionResult && isResultOpen && (
				<div className="infio-reasoning-content-wrapper">
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={false}
						wrapLines={true}
					>
						{toolExecutionResult.content}
					</MemoizedSyntaxHighlighterWrapper>
				</div>
			)}
		</div>
	)
} 
