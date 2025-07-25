import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import clsx from 'clsx'
import {
	COMMAND_PRIORITY_NORMAL,
	TextNode
} from 'lexical'
import { SquareSlash } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

import { QuickCommand, useCommands } from '../../../../../hooks/use-commands'
import { MenuOption } from '../shared/LexicalMenu'
import {
	LexicalTypeaheadMenuPlugin,
	useBasicTypeaheadTriggerMatch,
} from '../typeahead-menu/LexicalTypeaheadMenuPlugin'

import { $createCommandNode } from './CommandNode'

class CommandTypeaheadOption extends MenuOption {
	name: string
	command: QuickCommand

	constructor(name: string, command: QuickCommand) {
		super(name)
		this.name = name
		this.command = command
	}
}

function CommandMenuItem({
	index,
	isSelected,
	onClick,
	onMouseEnter,
	option,
}: {
	index: number
	isSelected: boolean
	onClick: () => void
	onMouseEnter: () => void
	option: CommandTypeaheadOption
}) {
	return (
		<li
			key={option.key}
			tabIndex={-1}
			className={clsx('item', isSelected && 'selected')}
			ref={(el) => option.setRefElement(el)}
			role="option"
			aria-selected={isSelected}
			id={`typeahead-item-${index}`}
			onMouseEnter={onMouseEnter}
			onClick={onClick}
		>
			<SquareSlash size={14} className="infio-popover-item-icon" />
			<span>{option.name}</span>
		</li>
	)
}

export default function CommandPlugin() {
	const [editor] = useLexicalComposerContext()

	const { commandList } = useCommands()

	const [queryString, setQueryString] = useState<string | null>(null)
	const [searchResults, setSearchResults] = useState<QuickCommand[]>([])

	useEffect(() => {
		if (queryString == null) return
		const filteredCommands = commandList.filter(
			command =>
				command.name.toLowerCase().includes(queryString.toLowerCase()) ||
				command.contentText.toLowerCase().includes(queryString.toLowerCase())
		)
		setSearchResults(filteredCommands)
	}, [queryString, commandList])

	const options = useMemo(
		() =>
			searchResults.map(
				(result) => new CommandTypeaheadOption(result.name, result),
			),
		[searchResults],
	)

	const checkForTriggerMatch = useBasicTypeaheadTriggerMatch('/', {
		minLength: 0,
	})

	const onSelectOption = useCallback(
		(
			selectedOption: CommandTypeaheadOption,
			nodeToRemove: TextNode | null,
			closeMenu: () => void,
		) => {
			editor.update(() => {
				// Create a CommandNode instead of inserting the full command content
				const commandNode = $createCommandNode(
					selectedOption.command.name,
					selectedOption.command.id
				)
				
				if (nodeToRemove) {
					const parent = nodeToRemove.getParentOrThrow()
					parent.splice(nodeToRemove.getIndexWithinParent(), 1, [commandNode])
					commandNode.selectEnd()
				}
				closeMenu()
			})
		},
		[editor],
	)

	return (
		<LexicalTypeaheadMenuPlugin<CommandTypeaheadOption>
			onQueryChange={setQueryString}
			onSelectOption={onSelectOption}
			triggerFn={checkForTriggerMatch}
			options={options}
			commandPriority={COMMAND_PRIORITY_NORMAL}
			menuRenderFn={(
				anchorElementRef,
				{ selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
			) =>
				anchorElementRef.current && searchResults.length
					? createPortal(
						<div className="infio-popover infio-command-popover">
							<ul>
								{options.map((option, i: number) => (
									<CommandMenuItem
										index={i}
										isSelected={selectedIndex === i}
										onClick={() => {
											setHighlightedIndex(i)
											selectOptionAndCleanUp(option)
										}}
										onMouseEnter={() => {
											setHighlightedIndex(i)
										}}
										key={option.key}
										option={option}
									/>
								))}
							</ul>
						</div>,
						anchorElementRef.current,
					)
					: null
			}
		/>
	)
}
