import { Change, diffLines } from 'diff'
import { Platform, getIcon } from 'obsidian'
import { useEffect, useState } from 'react'
import ContentEditable from 'react-contenteditable'

import { ApplyViewState } from '../../ApplyView'
import { useApp } from '../../contexts/AppContext'
import { useApplyEditManager } from '../../contexts/ApplyEditManagerContext'
import { t } from '../../lang/helpers'

// Enhanced diff type that includes replacement information
interface EnhancedChange extends Change {
	isReplacement?: boolean
	replacementGroupId?: string
	replacementType?: 'removed' | 'added'
}

// Function to detect replacements in diff
const detectReplacements = (changes: Change[]): EnhancedChange[] => {
	const enhanced: EnhancedChange[] = changes.map(change => ({ ...change }))
	let groupId = 0

	for (let i = 0; i < enhanced.length - 1; i++) {
		const current = enhanced[i]
		const next = enhanced[i + 1]

		// Look for pattern: removed followed by added
		if (current.removed && next.added) {
			const currentGroupId = `replacement-${groupId++}`
			
			// Mark current as removed part of replacement
			current.isReplacement = true
			current.replacementGroupId = currentGroupId
			current.replacementType = 'removed'
			
			// Mark next as added part of replacement
			next.isReplacement = true
			next.replacementGroupId = currentGroupId
			next.replacementType = 'added'
		}
	}

	return enhanced
}

export default function ApplyViewRoot({ state, close }: {
	state: ApplyViewState
	close: () => void
}) {
	const acceptIcon = getIcon('check')
	const rejectIcon = getIcon('x')
	const excludeIcon = getIcon('x')

	const getShortcutText = (shortcut: 'accept' | 'reject') => {
		const isMac = Platform.isMacOS
		if (shortcut === 'accept') {
			return isMac ? '(⌘⏎)' : '(Ctrl+⏎)'
		}
		return isMac ? '(⌘⌫)' : '(Ctrl+⌫)'
	}

	const app = useApp()
	const applyEditManager = useApplyEditManager()

	// Track which lines have been accepted or excluded
	const [diffStatus, setDiffStatus] = useState<Array<'active' | 'accepted' | 'excluded'>>([])

	const [diff] = useState<EnhancedChange[]>(() => {
		const initialDiff = diffLines(state.oldContent, state.newContent)
		const enhancedDiff = detectReplacements(initialDiff)
		// Initialize all lines as 'active'
		setDiffStatus(enhancedDiff.map(() => 'active'))
		return enhancedDiff
	})

	const [editedContents, setEditedContents] = useState<string[]>(() => {
		return diff.map((change) => change.value)
	})

	// After the state is initialized, set up the status array
	useEffect(() => {
		if (diffStatus.length === 0) {
			setDiffStatus(diff.map(() => 'active'))
		}
	}, [diff, diffStatus.length])

	const acceptReplacement = (groupId: string) => {
		setDiffStatus(prevStatus => {
			const newStatus = [...prevStatus]
			diff.forEach((change, index) => {
				if (change.replacementGroupId === groupId) {
					if (change.replacementType === 'removed') {
						newStatus[index] = 'excluded' // Remove the old content
					} else if (change.replacementType === 'added') {
						newStatus[index] = 'accepted' // Keep the new content
					}
				}
			})
			return newStatus
		})
	}

	const rejectReplacement = (groupId: string) => {
		setDiffStatus(prevStatus => {
			const newStatus = [...prevStatus]
			diff.forEach((change, index) => {
				if (change.replacementGroupId === groupId) {
					if (change.replacementType === 'removed') {
						newStatus[index] = 'accepted' // Keep the old content
					} else if (change.replacementType === 'added') {
						newStatus[index] = 'excluded' // Remove the new content
					}
				}
			})
			return newStatus
		})
	}

	const handleAccept = async () => {
		// 如果有 editId，使用 ApplyEditManager 处理
		if (state.editId && applyEditManager) {
			try {
				await applyEditManager.apply(state.editId)
				if (state.onClose) {
					state.onClose(true)
				}
				close()
			} catch (error) {
				console.error('Failed to apply edit:', error)
			}
			return
		}

		// 兼容旧的直接应用逻辑
		const newContent = diff.reduce((result, change, index) => {
			const status = diffStatus[index]
			
			// For unchanged content, always include
			if (!change.added && !change.removed) {
				return result + editedContents[index]
			}
			
			// For changes that have been explicitly accepted, include them
			if (status === 'accepted') {
				return result + editedContents[index]
			}
			
			// For changes that have been explicitly excluded, skip them
			if (status === 'excluded') {
				return result
			}
			
			// For active changes (default behavior when accepting all):
			if (status === 'active') {
				// For replacements, include added content and skip removed content
				if (change.isReplacement) {
					if (change.replacementType === 'added') {
						return result + editedContents[index]
					} else if (change.replacementType === 'removed') {
						return result // Skip removed content in replacements
					}
				}
				// For non-replacement additions, include them
				else if (change.added) {
					return result + editedContents[index]
				}
				// For non-replacement removals, skip them
				else if (change.removed) {
					return result
				}
			}
			
			return result
		}, '')
		const file = app.vault.getFileByPath(state.file)
		if (!file) {
			throw new Error(String(t('applyView.fileNotFound')))
		}
		await app.vault.modify(file, newContent)
		if (state.onClose) {
			state.onClose(true)
		}
		close()
	}

	const handleReject = async () => {
		// 如果有 editId，使用 ApplyEditManager 处理
		if (state.editId && applyEditManager) {
			try {
				await applyEditManager.reject(state.editId)
			} catch (error) {
				console.error('Failed to reject edit:', error)
			}
		}

		if (state.onClose) {
			state.onClose(false)
		}
		close()
	}

	const excludeDiffLine = (index: number) => {
		setDiffStatus(prevStatus => {
			const newStatus = [...prevStatus]
			// Mark line as excluded
			newStatus[index] = 'excluded'
			return newStatus
		})
	}

	const acceptDiffLine = (index: number) => {
		setDiffStatus(prevStatus => {
			const newStatus = [...prevStatus]
			// Mark line as accepted
			newStatus[index] = 'accepted'
			return newStatus
		})
	}

	const handleKeyDown = (event: KeyboardEvent) => {
		const modifierKey = Platform.isMacOS ? event.metaKey : event.ctrlKey;
		if (modifierKey) {
			if (event.key === 'Enter') {
				event.preventDefault();
				event.stopPropagation();
				handleAccept();
			} else if (event.key === 'Backspace') {
				event.preventDefault();
				event.stopPropagation();
				handleReject();
			}
		}
	}

	// Handle content editing changes
	const handleContentChange = (index: number, evt: { target: { value: string } }) => {
		const newEditedContents = [...editedContents];
		newEditedContents[index] = evt.target.value;
		setEditedContents(newEditedContents);
	}

	// Add event listeners on mount and remove on unmount
	useEffect(() => {
		const handler = (e: KeyboardEvent) => handleKeyDown(e);
		window.addEventListener('keydown', handler, true);
		return () => {
			window.removeEventListener('keydown', handler, true);
		}
	}, [handleAccept, handleReject]) // Dependencies for the effect

	return (
		<div id="infio-apply-view">
			<div className="view-header">
				<div className="view-header-left">
					<div className="view-header-nav-buttons"></div>
				</div>
				<div className="view-header-title-container mod-at-start">
					<div className="view-header-title">
						{t('applyView.applyingFile').replace('{{file}}', state?.file ?? '')}
					</div>
					<div className="view-actions">
						<button
							className="clickable-icon view-action infio-approve-button"
							aria-label={t('applyView.acceptChanges')}
							onClick={handleAccept}
						>
							{acceptIcon && '✓'}
							{t('applyView.acceptAll').replace('{{shortcut}}', getShortcutText('accept'))}
						</button>
						<button
							className="clickable-icon view-action infio-reject-button"
							aria-label={t('applyView.rejectChanges')}
							onClick={handleReject}
						>
							{rejectIcon && '✗'}
							{t('applyView.rejectAll').replace('{{shortcut}}', getShortcutText('reject'))}
						</button>
					</div>
				</div>
			</div>

			<div className="view-content">
				<div className="markdown-source-view cm-s-obsidian mod-cm6 node-insert-event is-readable-line-width is-live-preview is-folding show-properties">
					<div className="cm-editor">
						<div className="cm-scroller">
							<div className="cm-sizer">
								<div className="infio-inline-title">
									{state?.file
										? state.file.replace(/\.[^/.]+$/, '')
										: ''}
								</div>

								{diff.map((part, index) => {
									// Determine line display status based on diffStatus
									const status = diffStatus[index]
									const isHidden = status === 'excluded'

									if (isHidden) return null

									// Check if this is part of a replacement group
									const isReplacementGroup = part.isReplacement && part.replacementGroupId
									const isLastInGroup = isReplacementGroup && 
										(index === diff.length - 1 || diff[index + 1].replacementGroupId !== part.replacementGroupId)

									return (
										<div
											key={index}
											className={`infio-diff-line ${
												part.added ? 'added' : part.removed ? 'removed' : ''
											} ${
												part.isReplacement ? 'replacement' : ''
											} ${
												status !== 'active' ? status : ''
											}`}
										>
											<div className="infio-diff-content-wrapper">
												<ContentEditable
													html={editedContents[index]}
													onChange={(evt) => handleContentChange(index, evt)}
													className="infio-editable-content"
												/>
												{/* Show replacement actions for last item in replacement group */}
												{isLastInGroup && status === 'active' && part.replacementGroupId && (
													<div className="infio-diff-line-actions">
														<button
															aria-label={t('applyView.acceptReplacement')}
															onClick={() => acceptReplacement(part.replacementGroupId)}
															className="infio-accept"
														>
															{acceptIcon && '✓'}
														</button>
														<button
															aria-label={t('applyView.rejectReplacement')}
															onClick={() => rejectReplacement(part.replacementGroupId)}
															className="infio-exclude"
														>
															{rejectIcon && '✗'}
														</button>
													</div>
												)}
												{/* Show individual line actions only for non-replacement lines */}
												{(part.added || part.removed) && status === 'active' && !part.isReplacement && (
													<div className="infio-diff-line-actions">
														<button
															aria-label={t('applyView.acceptLine')}
															onClick={() => acceptDiffLine(index)}
															className="infio-accept"
														>
															{acceptIcon && '✓'}
														</button>
														<button
															aria-label={t('applyView.excludeLine')}
															onClick={() => excludeDiffLine(index)}
															className="infio-exclude"
														>
															{excludeIcon && '✗'}
														</button>
													</div>
												)}
											</div>
										</div>
									)
								})}
							</div>
						</div>
					</div>
				</div>
			</div>
			<style>{`
        .infio-diff-content-wrapper {
          position: relative;
          width: 100%;
        }
        
        .infio-editable-content {
          width: 100%;
          min-height: 1.2em;
          padding: 4px;
          padding-right: 60px;
          border: 1px solid transparent;
          box-sizing: border-box;
        }

        .infio-editable-content:focus {
          outline: none;
          border-color: var(--interactive-accent);
          background-color: var(--background-primary);
        }
        
        .infio-diff-line-actions {
          position: absolute;
          right: 4px;
          bottom: 4px;
          display: flex;
          gap: 4px;
        }
        
        .infio-diff-line-actions button {
          padding: 2px 6px;
          border-radius: 4px;
          background: var(--background-secondary);
          border: 1px solid var(--background-modifier-border);
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.2s;
        }
        
        .infio-diff-line-actions button:hover {
          opacity: 1;
        }
        
        .infio-accept {
          color: #26a69a;
        }
        
        .infio-exclude {
          color: #ef5350;
        }

        .infio-diff-line.added .infio-editable-content {
          background-color: rgba(0, 255, 0, 0.1);
          border-left: 3px solid #26a69a;
        }

        .infio-diff-line.removed .infio-editable-content {
          background-color: rgba(255, 0, 0, 0.1);
          border-left: 3px solid #ef5350;
          text-decoration: line-through;
        }

        .infio-diff-line.accepted .infio-editable-content {
          opacity: 0.7;
        }

        /* Replacement styles - keep consistent with add/remove */
        .infio-diff-line.replacement.removed .infio-editable-content {
          background-color: rgba(255, 0, 0, 0.1);
          border-left: 3px solid #ef5350;
          text-decoration: line-through;
        }
        
        .infio-diff-line.replacement.added .infio-editable-content {
          background-color: rgba(0, 255, 0, 0.1);
          border-left: 3px solid #26a69a;
        }
      `}</style>
		</div>
	)
}
