import { FileSearch } from 'lucide-react'
import React from 'react'

import { useApp } from "../../../contexts/AppContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, RegexSearchFilesToolArgs } from "../../../types/apply"
import { openMarkdownFile } from "../../../utils/obsidian"

export default function MarkdownRegexSearchFilesBlock({
	applyStatus,
	onApply,
	path,
	regex,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: RegexSearchFilesToolArgs) => void
	path: string,
	regex: string,
	finish: boolean
}) {
	const app = useApp()

	const handleClick = () => {
		openMarkdownFile(app, path)
	}

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'regex_search_files',
				filepath: path,
				regex: regex,
				file_pattern: ".md",
			})
		}
	}, [finish])

	return (
		<div
			className={`infio-chat-code-block infio-regex-search-files-block ${path ? 'has-filename' : ''}`}
			onClick={handleClick}
		>
			<div className={'infio-chat-code-block-header'}>
				<div className={'infio-chat-code-block-header-filename'}>
					<FileSearch size={14} className="infio-chat-code-block-header-icon" />
					<span>{t('chat.reactMarkdown.regexSearchInPath').replace('{regex}', regex).replace('{path}', path)}</span>
				</div>
			</div>
		</div>
	)
} 
