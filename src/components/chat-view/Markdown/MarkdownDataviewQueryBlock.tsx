import { Check, ChevronDown, ChevronRight, Database, Loader2, X } from 'lucide-react'
import React, { useState } from 'react'

import { t } from '../../../lang/helpers'
import { ApplyStatus, DataviewQueryToolArgs } from "../../../types/apply"

export default function MarkdownDataviewQueryBlock({
	applyStatus,
	onApply,
	query,
	outputFormat,
	finish
}: {
	applyStatus: ApplyStatus
	onApply: (args: DataviewQueryToolArgs) => void
	query: string
	outputFormat: string
	finish: boolean
}) {
	const [isOpen, setIsOpen] = useState(false)
	const [isHovered, setIsHovered] = useState(false)

	React.useEffect(() => {
		if (finish && applyStatus === ApplyStatus.Idle) {
			onApply({
				type: 'dataview_query',
				query: query,
				outputFormat: outputFormat,
			})
		}
	}, [finish])

	return (
		<div 
			className={`infio-chat-code-block infio-dataview-query-block has-filename`}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
		>
			<div className={'infio-chat-code-block-header'}>
				<div 
					className={'infio-chat-code-block-header-filename'}
					onClick={() => setIsOpen(!isOpen)}
					style={{ cursor: isHovered ? 'pointer' : 'default' }}
				>
					{isHovered ? (
						isOpen ? <ChevronDown size={14} className="infio-chat-code-block-header-icon" /> : <ChevronRight size={14} className="infio-chat-code-block-header-icon" />
					) : (
						<Database size={14} className="infio-chat-code-block-header-icon" />
					)}
					Dataview 查询 ({outputFormat})
				</div>
				<div className={'infio-chat-code-block-header-button'}>
					<button
						className="infio-dataview-query-button"
						disabled={true}
					>
						{
							!finish || applyStatus === ApplyStatus.Idle ? (
								<>
									<Loader2 className="spinner" size={14} /> 执行中...
								</>
							) : applyStatus === ApplyStatus.Applied ? (
								<>
									<Check size={14} /> 完成
								</>
							) : (
								<>
									<X size={14} /> 失败
								</>
							)}
					</button>
				</div>
			</div>
			{isOpen && (
				<div className={'infio-chat-code-block-content'}>
					<pre>
						<code>{query}</code>
					</pre>
				</div>
			)}
		</div>
	)
} 
