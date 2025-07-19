import { ChevronsDownUp, ChevronsUpDown, Server } from 'lucide-react'
import React, { useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { ApplyStatus, UseMcpToolArgs } from "../../../types/apply"

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

export default function UseMcpToolBlock({
	applyStatus,
	onApply,
	serverName,
	toolName,
	parameters,
	finish,
	toolExecutionResult
}: {
	applyStatus: ApplyStatus
	onApply: (args: UseMcpToolArgs) => void
	serverName: string,
	toolName: string,
	parameters: Record<string, unknown>,
	finish: boolean,
	toolExecutionResult?: {
		type: string
		status: ApplyStatus
		content: string
		timestamp: number
	}
}) {

	const { isDarkMode } = useDarkModeContext()
	const [isResultOpen, setIsResultOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'use_mcp_tool',
				server_name: serverName,
				tool_name: toolName,
				parameters: parameters,
			})
		}
	}, [finish])

	return (
		<div
			className={`infio-chat-code-block has-filename`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className={'infio-chat-code-block-header'}
				onClick={(e) => {
					e.stopPropagation()
					setIsResultOpen(!isResultOpen)
				}}
			>
				<div className={'infio-chat-code-block-header-filename'}>
					{isHovered ? (
						isResultOpen ? <ChevronsDownUp size={14} className="infio-chat-code-block-header-icon" /> : <ChevronsUpDown size={14} className="infio-chat-code-block-header-icon" />
					) : (
						<Server size={14} className="infio-chat-code-block-header-icon" />
					)}
					Use
					<span className="infio-mcp-tool-server-name">{serverName}</span>
					<span className="infio-mcp-tool-name">[{toolName}]</span>
				</div>
			</div>
			<div>
				<MemoizedSyntaxHighlighterWrapper
					isDarkMode={isDarkMode}
					language="json"
					hasFilename={false}
					wrapLines={false}
					backgroundColor="var(--background-modifier-form-field)"
				>
					{JSON.stringify(parameters, null, 2)}
				</MemoizedSyntaxHighlighterWrapper>
				{/* 工具执行结果显示区域 */}
				{toolExecutionResult && isResultOpen && (
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={false}
						wrapLines={false}
					>
						{String(toolExecutionResult.content)}
					</MemoizedSyntaxHighlighterWrapper>
				)}
			</div>
			<style>{`
				.infio-mcp-tool-row {
					padding: 12px;
					background-color: var(--background-primary);
					border-radius: var(--radius-s);
				}
				.infio-mcp-tool-row-result {
					padding: 12px;
					background-color: var(--background-secondary);
					border-radius: var(--radius-s);
				}
				.infio-chat-code-block-header {
					cursor: pointer;
				}
				.infio-mcp-tool-name {
					font-weight: 600;
					color: var(--text-normal);
					font-size: 14px;
				}
				.infio-mcp-tool-server-name {
					color: var(--text-accent);
					border-radius: 4px;
					margin-left: 4px;
					margin-right: 4px;
					font-weight: bold;
					font-size: 13px;
					display: inline-block;
				}
			`}</style>
		</div>
	)
} 
