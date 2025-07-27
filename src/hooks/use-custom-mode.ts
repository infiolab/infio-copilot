import { useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '../contexts/AppContext'
import { CustomModeManager } from '../database/json/custom-mode/CustomModeManager'
import { CustomMode } from '../database/json/custom-mode/types'
import { CustomModePrompts } from '../utils/modes'

type UseCustomModes = {
	createCustomMode: (
		name: string,
		roleDefinition: string,
		customInstructions: string,
		tools: string[],
		icon?: string
	) => Promise<void>
	deleteCustomMode: (id: string) => Promise<void>
	updateCustomMode: (
		id: string,
		name: string,
		roleDefinition: string,
		customInstructions: string,
		tools: string[],
		icon?: string
	) => Promise<void>
	FindCustomModeByName: (name: string) => Promise<CustomMode | undefined>
	customModeList: CustomMode[]
	customModePrompts: CustomModePrompts
}

export function useCustomModes(): UseCustomModes {

	const [customModeList, setCustomModeList] = useState<CustomMode[]>([])

	const app = useApp()
	const customModeManager = useMemo(() => new CustomModeManager(app), [app])

	const fetchCustomModeList = useCallback(async () => {
		customModeManager.ListCustomModes().then((rows) => {
			setCustomModeList(rows)
		})
	}, [customModeManager])

	const customModePrompts = useMemo(() => {
		return customModeList.reduce((acc, customMode) => {
			acc[customMode.slug] = {
				roleDefinition: customMode.roleDefinition,
				customInstructions: customMode.customInstructions,
			}
			return acc
		}, {} as CustomModePrompts)
	}, [customModeList])

	useEffect(() => {
		void fetchCustomModeList()
	}, [fetchCustomModeList])

	const createCustomMode = useCallback(
		async (
			name: string,
			roleDefinition: string,
			customInstructions: string,
			tools: string[],
			icon?: string
		): Promise<void> => {
			await customModeManager.createCustomMode({
				name,
				roleDefinition,
				customInstructions,
				tools,
				icon,
			})
			fetchCustomModeList()
		},
		[customModeManager, fetchCustomModeList],
	)

	const deleteCustomMode = useCallback(
		async (id: string): Promise<void> => {
			await customModeManager.deleteCustomMode(id)
			fetchCustomModeList()
		},
		[customModeManager, fetchCustomModeList],
	)

	const updateCustomMode = useCallback(
		async (id: string, name: string, roleDefinition: string, customInstructions: string, tools: string[], icon?: string): Promise<void> => {
			await customModeManager.updateCustomMode(id, {
				name,
				roleDefinition,
				customInstructions,
				tools,
				icon,
			})
			fetchCustomModeList()
		},
		[customModeManager, fetchCustomModeList],
	)

	const FindCustomModeByName = useCallback(
		async (name: string): Promise<CustomMode | undefined> => {
			return customModeList.find((customMode) => customMode.name === name)
		}, [customModeList])

	return {
		createCustomMode,
		deleteCustomMode,
		updateCustomMode,
		FindCustomModeByName,
		customModeList,
		customModePrompts,
	}
}
