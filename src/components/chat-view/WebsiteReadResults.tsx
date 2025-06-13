import { ChevronDown, ChevronRight, FileText, Globe } from 'lucide-react'
import { TFile } from 'obsidian'
import { useState } from 'react'

import { useApp } from '../../contexts/AppContext'
import { t } from '../../lang/helpers'

function WebsiteReadItem({
	websiteResult,
}: {
	websiteResult: { url: string, content: string }
}) {
	const app = useApp()

	const handleClick = () => {
		// 现在url字段实际上是markdown文件路径，直接在Obsidian中打开
		const file = app.vault.getAbstractFileByPath(websiteResult.url)
		if (file instanceof TFile) {
			app.workspace.getLeaf('tab').openFile(file)
		}
	}

	const getContentSize = (content: string) => {
		const bytes = new Blob([content]).size
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}

	const getFileBaseName = (filePath: string) => {
		return filePath.split('/').pop()?.replace('.md', '') || 'website'
	}

	const truncatePath = (filePath: string, maxLength: number = 60) => {
		if (filePath.length <= maxLength) return filePath
		return '...' + filePath.substring(filePath.length - maxLength)
	}

	return (
		<div onClick={handleClick} className="infio-website-read-item">
			<div className="infio-website-read-item__icon">
				<FileText size={16} />
			</div>
			<div className="infio-website-read-item__info">
				<div className="infio-website-read-item__domain">
					{getFileBaseName(websiteResult.url)}
				</div>
				<div className="infio-website-read-item__url">
					{truncatePath(websiteResult.url)}
				</div>
			</div>
			<div className="infio-website-read-item__actions">
				<div className="infio-website-read-item__size">
					{getContentSize(websiteResult.content)}
				</div>
			</div>
		</div>
	)
}

export default function WebsiteReadResults({
	websiteContents,
}: {
	websiteContents: Array<{ url: string, content: string }>
}) {
	const [isOpen, setIsOpen] = useState(false)

	return (
		<div className="infio-website-read-results">
			<div
				onClick={() => {
					setIsOpen(!isOpen)
				}}
				className="infio-website-read-results__trigger"
			>
				{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
				<div>
					{t('chat.websiteResults.showReadWebsites')} ({websiteContents.length})
				</div>
			</div>
			{isOpen && (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
					}}
				>
					{websiteContents.map((websiteResult, index) => (
						<WebsiteReadItem key={`${websiteResult.url}-${index}`} websiteResult={websiteResult} />
					))}
				</div>
			)}
		</div>
	)
} 
