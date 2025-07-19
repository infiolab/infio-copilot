import { memo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
	oneDark,
	oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'

function SyntaxHighlighterWrapper({
	isDarkMode,
	language,
	hasFilename,
	wrapLines,
	children,
	isOpen = true,
	backgroundColor,
}: {
	isDarkMode: boolean
	language: string | undefined
	hasFilename: boolean
	wrapLines: boolean
	children: string
	isOpen?: boolean
	backgroundColor?: string
}) {
	if (!isOpen) return null;
	
	const baseCustomStyle = {
		borderRadius: hasFilename
			? '0 0 var(--radius-s) var(--radius-s)'
			: 'var(--radius-s)',
		margin: 0,
		fontSize: 'var(--font-ui-small)',
		fontFamily:
			language === 'markdown' ? 'var(--font-interface)' : 'inherit',
	};

	// 获取基础主题样式
	const baseTheme = isDarkMode ? oneDark : oneLight;
	
	// 如果提供了自定义背景颜色，则深度覆盖所有相关的背景色
	let customTheme = baseTheme;
	if (backgroundColor) {
		// 深度复制主题对象并覆盖所有背景相关属性
		customTheme = {
			...baseTheme,
			'pre[class*="language-"]': {
				...baseTheme['pre[class*="language-"]'],
				background: backgroundColor,
				backgroundColor: backgroundColor,
			},
			'code[class*="language-"]': {
				...baseTheme['code[class*="language-"]'],
				background: backgroundColor,
				backgroundColor: backgroundColor,
			},
			// 覆盖根容器背景
			':not(pre) > code[class*="language-"]': {
				...baseTheme[':not(pre) > code[class*="language-"]'],
				background: backgroundColor,
				backgroundColor: backgroundColor,
			}
		};
		
		// 遍历主题对象，覆盖所有可能的背景属性
		Object.keys(customTheme).forEach(key => {
			if (customTheme[key] && typeof customTheme[key] === 'object') {
				if (customTheme[key].background || customTheme[key].backgroundColor) {
					customTheme[key] = {
						...customTheme[key],
						background: backgroundColor,
						backgroundColor: backgroundColor,
					};
				}
			}
		});
	}

	// 合并自定义样式
	const customStyle = backgroundColor 
		? { ...baseCustomStyle, backgroundColor, background: backgroundColor }
		: baseCustomStyle;
	
	return (
		<SyntaxHighlighter
			language={language}
			style={customTheme}
			customStyle={customStyle}
			wrapLines={wrapLines}
			lineProps={
				// Wrapping should work without lineProps, but Obsidian's default CSS seems to override SyntaxHighlighter's styles.
				// We manually override the white-space property to ensure proper wrapping.
				wrapLines
					? {
						style: { whiteSpace: 'pre-wrap' },
					}
					: undefined
			}
		>
			{children}
		</SyntaxHighlighter>
	)
}

export const MemoizedSyntaxHighlighterWrapper = memo(SyntaxHighlighterWrapper)
