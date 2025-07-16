import { Eye } from 'lucide-react'
import React from 'react'

import { useApp } from "../../../contexts/AppContext"
import { t } from '../../../lang/helpers'
import { ApplyStatus, ReadFileToolArgs } from "../../../types/apply"
import { openMarkdownFile } from "../../../utils/obsidian"

export default function MarkdownReadFileBlock({
	applyStatus,
	onApply,
	path,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: ReadFileToolArgs) => void
	path: string,
	finish: boolean
}) {
	const app = useApp()

	const handleClick = () => {
		openMarkdownFile(app, path)
	}

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'read_file',
				filepath: path
			})
		}
	}, [finish])

	return (
		<div
			className={`infio-chat-code-block infio-read-file-block ${path ? 'has-filename' : ''}`}
			onClick={handleClick}
		>
			<div className={'infio-chat-code-block-header'}>
				<div className={'infio-chat-code-block-header-filename'}>
					<Eye size={10} className="infio-chat-code-block-header-icon" />
					{t('chat.reactMarkdown.readFile').replace('{path}', path)}
				</div>
			</div>
		</div>
	)
} 
