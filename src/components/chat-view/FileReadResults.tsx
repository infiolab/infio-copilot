import path from 'path'

import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { useState } from 'react'

import { useApp } from '../../contexts/AppContext'
import { t } from '../../lang/helpers'
import { openMarkdownFile } from '../../utils/obsidian'

function FileReadItem({
	fileResult,
}: {
	fileResult: { path: string, content: string }
}) {
	const app = useApp()

	const handleClick = () => {
		openMarkdownFile(app, fileResult.path)
	}

	const getFileSize = (content: string) => {
		const bytes = new Blob([content]).size
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}

	return (
		<div onClick={handleClick} className="infio-file-read-item">
			<div className="infio-file-read-item__icon">
				<FileText size={16} />
			</div>
			<div className="infio-file-read-item__info">
				<div className="infio-file-read-item__name">
					{path.basename(fileResult.path)}
				</div>
				<div className="infio-file-read-item__path">
					{fileResult.path}
				</div>
			</div>
			<div className="infio-file-read-item__size">
				{getFileSize(fileResult.content)}
			</div>
		</div>
	)
}

export default function FileReadResults({
	fileContents,
}: {
	fileContents: Array<{ path: string, content: string }>
}) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div className="infio-file-read-results">
			<div
				onClick={() => {
					setIsOpen(!isOpen)
				}}
				className="infio-file-read-results__trigger"
			>
				{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
				<div>
					{t('chat.fileResults.showReadFiles')} ({fileContents.length})
				</div>
			</div>
			{isOpen && (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{fileContents.map((fileResult, index) => (
						<FileReadItem key={`${fileResult.path}-${index}`} fileResult={fileResult} />
					))}
				</div>
			)}
		</div>
	)
} 
