import { SelectVector } from '../../database/schema'
import { t } from '../../lang/helpers'
export type QueryProgressState =
	| {
		type: 'reading-mentionables'
	}
	| {
		type: 'reading-files'
		currentFile?: string
		totalFiles?: number
		completedFiles?: number
	}
	| {
		type: 'reading-files-done'
		fileContents: Array<{ path: string, content: string }>
	}
	| {
		type: 'reading-websites'
		currentUrl?: string
		totalUrls?: number
		completedUrls?: number
	}
	| {
		type: 'reading-websites-done'
		websiteContents: Array<{ url: string, content: string }>
	}
	| {
		type: 'indexing'
		indexProgress: IndexProgress
	}
	| {
		type: 'querying'
	}
	| {
		type: 'querying-done'
		queryResult: (Omit<SelectVector, 'embedding'> & { similarity: number })[]
	}
	| {
		type: 'idle'
	}

export type IndexProgress = {
	completedChunks: number
	totalChunks: number
	totalFiles: number
}

// TODO: Update style
export default function QueryProgress({
	state,
}: {
	state: QueryProgressState
}) {
	switch (state.type) {
		case 'idle':
			return null
		case 'reading-mentionables':
			return (
				<div className="infio-query-progress">
					<p>
						{t('chat.queryProgress.readingMentionableFiles')}
						<DotLoader />
					</p>
				</div>
			)
		case 'reading-files':
			return (
				<div className="infio-query-progress">
					<p>
						{t('chat.queryProgress.readingFiles')}
						<DotLoader />
					</p>
					{state.currentFile && (
						<p className="infio-query-progress-detail">
							{state.currentFile}
							{state.totalFiles && state.completedFiles !== undefined && (
								<span> ({state.completedFiles}/{state.totalFiles})</span>
							)}
						</p>
					)}
				</div>
			)
		case 'reading-files-done':
			return (
				<div className="infio-query-progress">
					<p>
						{t('chat.queryProgress.readingFilesDone')}
					</p>
					<p className="infio-query-progress-detail">
						{t('chat.queryProgress.filesLoaded').replace('{count}', state.fileContents.length.toString())}
					</p>
				</div>
			)
		case 'reading-websites':
			return (
				<div className="infio-query-progress">
					<p>
						{t('chat.queryProgress.readingWebsites')}
						<DotLoader />
					</p>
					{state.currentUrl && (
						<p className="infio-query-progress-detail">
							{state.currentUrl}
							{state.totalUrls && state.completedUrls !== undefined && (
								<span> ({state.completedUrls}/{state.totalUrls})</span>
							)}
						</p>
					)}
				</div>
			)
		case 'reading-websites-done':
			return (
				<div className="infio-query-progress">
					<p>
						{t('chat.queryProgress.readingWebsitesDone')}
					</p>
					<p className="infio-query-progress-detail">
						{t('chat.queryProgress.websitesLoaded').replace('{count}', state.websiteContents.length.toString())}
					</p>
				</div>
			)
		case 'indexing':
			return (
				<div className="infio-query-progress">
					<p>
						{`${t('chat.queryProgress.indexing')} ${state.indexProgress.totalFiles} ${t('chat.queryProgress.file')}`}
						<DotLoader />
					</p>
					<p className="infio-query-progress-detail">{`${state.indexProgress.completedChunks}/${state.indexProgress.totalChunks} ${t('chat.queryProgress.chunkIndexed')}`}</p>
				</div>
			)
		case 'querying':
			return (
				<div className="infio-query-progress">
					<p>
						{t('chat.queryProgress.queryingVault')}
						<DotLoader />
					</p>
				</div>
			)
		case 'querying-done':
			return (
				<div className="infio-query-progress">
					<p>
						{t('chat.queryProgress.readingRelatedFiles')}
						<DotLoader />
					</p>
					{state.queryResult.map((result) => (
						<div key={result.path}>
							<p>{result.path}</p>
							<p>{result.similarity}</p>
						</div>
					))}
				</div>
			)
	}
}

function DotLoader() {
	return <span className="infio-dot-loader" aria-label="Loading"></span>
}
