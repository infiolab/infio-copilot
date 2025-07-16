import { CheckCheck, ChevronDown, ChevronRight } from 'lucide-react'
import React, { PropsWithChildren, useEffect, useRef, useState } from 'react'

import { useDarkModeContext } from "../../../contexts/DarkModeContext"
import { t } from '../../../lang/helpers'

import { MemoizedSyntaxHighlighterWrapper } from "./SyntaxHighlighterWrapper"

const processContent = (content: string): { serverName: string; processedContent: string } => {
	const lines = content.split('\n');
	const firstLine = lines[0];

	// 提取 serverName
	const serverNameRegex = /\[use_mcp_tool for '([^']+)'\]/;
	const serverNameMatch = serverNameRegex.exec(firstLine);
	const serverName = serverNameMatch ? serverNameMatch[1] : '';

	// 移除第一行并重新组合内容
	const processedContent = lines.slice(1).join('\n');

	return { serverName, processedContent };
};

export default function MarkdownToolResult({
	content,
	toolName,
}: PropsWithChildren<{
	content: string
	toolName?: string
}>) {
	const { isDarkMode } = useDarkModeContext()
	const containerRef = useRef<HTMLDivElement>(null)
	const [isOpen, setIsOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	const { serverName, processedContent } = React.useMemo(() => processContent(content), [content]);

	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.scrollTop = containerRef.current.scrollHeight
		}
	}, [processedContent])

	return (
		processedContent && (
			<div
				className={`infio-chat-code-block-response infio-tool-result-block has-filename infio-reasoning-block`}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
			>
				<div className={'infio-chat-code-block-response-header'}>
					<div 
						className={'infio-chat-code-block-response-header-filename'}
						onClick={() => setIsOpen(!isOpen)}
						style={{ cursor: isHovered ? 'pointer' : 'default' }}
					>
						{isHovered ? (
							isOpen ? <ChevronDown size={14} className="infio-chat-code-block-response-header-icon" /> : <ChevronRight size={14} className="infio-chat-code-block-response-header-icon" />
						) : (
							<CheckCheck size={14} className="infio-chat-code-block-response-header-icon" />
						)}
						{t('response_from_tool')}
						{toolName && <span className="infio-mcp-tool-name">{toolName}</span>}
						{serverName && <span className="infio-mcp-tool-server-name">{serverName}</span>}
					</div>
				</div>
				<div
					ref={containerRef}
					className="infio-reasoning-content-wrapper"
				>
					<MemoizedSyntaxHighlighterWrapper
						isDarkMode={isDarkMode}
						language="markdown"
						hasFilename={true}
						wrapLines={true}
						isOpen={isOpen}
					>
						{processedContent}
					</MemoizedSyntaxHighlighterWrapper>
				</div>
				<style>
					{`

					.infio-chat-code-block-response {
						position: relative;
						border: 1px solid var(--background-modifier-border);
						border-radius: var(--radius-s);
						margin-top: -10px;
						margin-bottom: 12px;
					}

					.infio-chat-code-block-response.infio-reasoning-block {
						max-height: 200px;
						overflow: hidden;
					}

					.infio-chat-code-block-response code {
						padding: 0;
					}

					.infio-chat-code-block-response-header {
						display: none;
						justify-content: space-between;
						align-items: center;
						font-size: var(--font-smallest);
						padding: 0 var(--size-4-1) 0 0;
					}

					.infio-chat-code-block-response:hover .infio-chat-code-block-response-header {
						position: absolute;
						top: calc(var(--size-4-3) * -1);
						right: var(--size-4-1);
						display: flex;
					}

					.infio-chat-code-block-response.has-filename .infio-chat-code-block-response-header {
						display: flex;
						border-bottom: 1px solid var(--background-modifier-border);
						background-color: var(--background-secondary);
						border-radius: var(--radius-s) var(--radius-s) 0 0;
						height: calc(var(--size-4-8) - var(--size-4-1));
					}

					.infio-chat-code-block-response.has-filename:hover .infio-chat-code-block-response-header {
						position: inherit;
						top: 0;
						left: 0;
					}

					.infio-chat-code-block-response-header-filename {
						padding-left: var(--size-4-2);
						font-size: var(--font-medium);
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
						display: flex;
						align-items: center;
						gap: var(--size-2-1);
					}

					.infio-chat-code-block-response-header-icon {
						margin-right: 6px;
						flex-shrink: 0;
					}

					.infio-chat-code-block-response-header-button {
						display: flex;
						gap: var(--size-4-1);
						right: 0;
						font-family: var(--font-interface);
						padding: 0;
						font-size: var(--font-small);
						font-weight: var(--font-medium);
						color: var(--text-muted);
					}

					.infio-chat-code-block-response.has-filename .infio-chat-code-block-response-header-button {
						gap: 0;
						overflow: hidden;
						min-width: fit-content;
						height: 100%;
					}

					.infio-chat-code-block-response.has-filename
						.infio-chat-code-block-response-header-button
						button {
						box-shadow: none;
						border: 0;
						padding: 0 var(--size-4-2);
						border-radius: 0;
						background-color: var(--background-primary);
						font-size: var(--font-medium);
						height: 100%;
						cursor: pointer;

						&:hover {
							background-color: var(--background-modifier-hover);
						}
					}

					.infio-chat-code-block-response-header-button button {
						display: flex;
						gap: var(--size-4-1);
						font-size: var(--font-ui-smaller);
					}

					.infio-chat-code-block-response-content {
						margin: 0;
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

				.infio-mcp-tool-name {
					color: var(--text-accent);
					border-radius: 4px;
					margin-left: 4px;
					margin-right: 4px;
					font-weight: bold;
					font-size: 13px;
					display: inline-block;
				}

				/* Tool Result Block - Minimal styling for better integration */
				.infio-tool-result-block {
					border: none !important;
					background: none !important;
					border-radius: 0 !important;
					margin-top: -8px !important;
					margin-bottom: 4px !important;
					color: var(--text-muted) !important;
				}

				.infio-tool-result-block .infio-chat-code-block-response-header {
					background-color: transparent !important;
					border-bottom: none !important;
				}

				.infio-tool-result-block .infio-chat-code-block-response-header-filename {
					color: var(--text-muted) !important;
				}

				.infio-tool-result-block .infio-mcp-tool-server-name {
					color: var(--text-muted) !important;
				}

				.infio-tool-result-block .infio-mcp-tool-name {
					color: var(--text-muted) !important;
				}

				.infio-tool-result-block .infio-chat-code-block-response-header-filename {
					transition: all 0.2s ease;
				}

				.infio-tool-result-block .infio-chat-code-block-response-header-filename:hover {
					opacity: 0.7;
				}
					`}
				</style>
			</div>
		)
	)
}
