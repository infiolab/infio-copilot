import { useCallback, useEffect, useMemo, useState } from 'react'

import { lexicalNodeToPlainText } from '../components/chat-view/chat-input/utils/editor-state-to-plain-text'
import { useApp } from '../contexts/AppContext'
import { CommandManager } from '../database/json/command/CommandManager'
import { TemplateContent } from '../database/schema'

export interface QuickCommand {
	id: string
	name: string
	content: TemplateContent
	contentText: string
	icon?: string
	starred?: boolean
	createdAt: number
	updatedAt: number
}

type UseCommands = {
	createCommand: (name: string, content: TemplateContent, icon?: string) => Promise<void>
	deleteCommand: (id: string) => Promise<void>
	updateCommand: (id: string, name: string, content: TemplateContent, icon?: string) => Promise<void>
	toggleStarCommand: (id: string) => Promise<void>
	commandList: QuickCommand[]
	starredCommands: QuickCommand[]
}

// 定义自定义事件名称
const COMMANDS_UPDATED_EVENT = 'infio-commands-updated'

// 用于触发全局命令更新事件的函数
const dispatchCommandsUpdateEvent = () => {
	window.dispatchEvent(new CustomEvent(COMMANDS_UPDATED_EVENT))
}

export function useCommands(): UseCommands {

	const [commandList, setCommandList] = useState<QuickCommand[]>([])
	const [starredCommands, setStarredCommands] = useState<QuickCommand[]>([])

	const app = useApp()
	const templateManager = useMemo(() => new CommandManager(app), [app])

	const fetchCommandList = useCallback(async () => {
		templateManager.ListCommands().then((rows) => {
			const commands = rows.map((row) => ({
				id: row.id,
				name: row.name,
				content: row.content,
				contentText: row.content.nodes.map(lexicalNodeToPlainText).join(''),
				icon: row.icon,
				starred: row.starred,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}))
			setCommandList(commands)
			setStarredCommands(commands.filter(cmd => cmd.starred === true))
		})
	}, [templateManager])

	useEffect(() => {
		void fetchCommandList()
	}, [fetchCommandList])

	// 监听全局命令更新事件
	useEffect(() => {
		const handleCommandsUpdate = () => {
			void fetchCommandList()
		}

		window.addEventListener(COMMANDS_UPDATED_EVENT, handleCommandsUpdate)
		
		return () => {
			window.removeEventListener(COMMANDS_UPDATED_EVENT, handleCommandsUpdate)
		}
	}, [fetchCommandList])

	const createCommand = useCallback(
		async (name: string, content: TemplateContent, icon?: string): Promise<void> => {
			await templateManager.createCommand({
				name,
				content,
				icon,
			})
			fetchCommandList()
			// 通知所有其他组件数据已更新
			dispatchCommandsUpdateEvent()
		},
		[templateManager, fetchCommandList],
	)

	const deleteCommand = useCallback(
		async (id: string): Promise<void> => {
			await templateManager.deleteCommand(id)
			fetchCommandList()
			// 通知所有其他组件数据已更新
			dispatchCommandsUpdateEvent()
		},
		[templateManager, fetchCommandList],
	)

	const updateCommand = useCallback(
		async (id: string, name: string, content: TemplateContent, icon?: string): Promise<void> => {
			await templateManager.updateCommand(id, {
				name,
				content,
				icon,
			})
			fetchCommandList()
			// 通知所有其他组件数据已更新
			dispatchCommandsUpdateEvent()
		},
		[templateManager, fetchCommandList],
	)

	const toggleStarCommand = useCallback(
		async (id: string): Promise<void> => {
			await templateManager.toggleStarCommand(id)
			fetchCommandList()
			// 通知所有其他组件数据已更新
			dispatchCommandsUpdateEvent()
		},
		[templateManager, fetchCommandList],
	)

	return {
		createCommand,
		deleteCommand,
		updateCommand,
		toggleStarCommand,
		commandList,
		starredCommands,
	}
}
