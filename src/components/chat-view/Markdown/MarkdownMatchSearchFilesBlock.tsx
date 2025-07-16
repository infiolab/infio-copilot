import { FileSearch } from 'lucide-react'
import React from 'react'

import { useApp } from "../../../contexts/AppContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, MatchSearchFilesToolArgs } from "../../../types/apply"
import { openMarkdownFile } from "../../../utils/obsidian"

export default function MarkdownMatchSearchFilesBlock({
	applyStatus,
	onApply,
	path,
	query,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: MatchSearchFilesToolArgs) => void
	path: string,
	query: string,
	finish: boolean
}) {
	const app = useApp()

	const handleClick = () => {
		openMarkdownFile(app, path)
	}

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'match_search_files',
				filepath: path,
				query: query,
				file_pattern: ".md",
			})
		}
	}, [finish])

	return (
		<div
			className={`infio-chat-code-block infio-match-search-files-block ${path ? 'has-filename' : ''}`}
			onClick={handleClick}
		>
			<div className={'infio-chat-code-block-header'}>
				<div className={'infio-chat-code-block-header-filename'}>
					<FileSearch size={14} className="infio-chat-code-block-header-icon" />
					<span>{t('chat.reactMarkdown.matchSearchInPath').replace('{query}', query).replace('{path}', path)}</span>
				</div>
			</div>
		</div>
	)
} 
