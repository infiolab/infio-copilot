import { FolderOpen } from 'lucide-react'
import React from 'react'

import { useApp } from "../../../contexts/AppContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ListFilesToolArgs } from "../../../types/apply"
import { openMarkdownFile } from "../../../utils/obsidian"

export default function MarkdownListFilesBlock({
	applyStatus,
	onApply,
	path,
	recursive,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: ListFilesToolArgs) => void
	path: string,
	recursive: boolean,
	finish: boolean
}) {
	const app = useApp()

	const handleClick = () => {
		openMarkdownFile(app, path)
	}

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'list_files',
				filepath: path,
				recursive
			})
		}
	}, [finish])

	return (
		<div
			className={`infio-chat-code-block infio-list-files-block ${path ? 'has-filename' : ''}`}
			onClick={handleClick}
		>
			<div className={'infio-chat-code-block-header'}>
				<div className={'infio-chat-code-block-header-filename'}>
					<FolderOpen size={14} className="infio-chat-code-block-header-icon" />
					{t('chat.reactMarkdown.listFiles').replace('{path}', path)}
				</div>
			</div>
		</div>
	)
} 
