import { useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '../contexts/AppContext'
import { CustomModeManager } from '../database/json/custom-mode/CustomModeManager'
import { CustomMode } from '../database/json/custom-mode/types'
import { defaultModes } from '../utils/modes'

export type CustomModePrompts = {
	[slug: string]: {
		roleDefinition: string
		customInstructions?: string
	}
}

export interface UseCustomModes {
	createCustomMode: (
		name: string,
		roleDefinition: string,
		customInstructions: string,
		tools: string[],
		icon?: string,
		enabled?: boolean
	) => Promise<void>
	deleteCustomMode: (id: string) => Promise<void>
	updateCustomMode: (
		id: string,
		name: string,
		roleDefinition: string,
		customInstructions: string,
		tools: string[],
		icon?: string,
		enabled?: boolean
	) => Promise<void>
	toggleCustomModeEnabled: (id: string) => Promise<void>
	FindCustomModeByName: (name: string) => Promise<CustomMode | undefined>
	customModeList: CustomMode[]
	customModePrompts: CustomModePrompts
	// New builtin mode management functions
	builtinModeOverrides: CustomMode[]
	createOrUpdateBuiltinModeOverride: (
		slug: string,
		name: string,
		roleDefinition: string,
		customInstructions: string,
		tools: string[],
		icon?: string,
		enabled?: boolean
	) => Promise<void>
	resetBuiltinModeToDefault: (slug: string) => Promise<void>
	isBuiltinModeOverridden: (slug: string) => boolean
	getEffectiveBuiltinMode: (slug: string) => CustomMode | undefined
}

export function useCustomModes(): UseCustomModes {

	const [customModeList, setCustomModeList] = useState<CustomMode[]>([])
	const [builtinModeOverrides, setBuiltinModeOverrides] = useState<CustomMode[]>([])

	const app = useApp()
	const customModeManager = useMemo(() => new CustomModeManager(app), [app])

	const fetchCustomModeList = useCallback(async () => {
		customModeManager.listCustomModesOnly().then((rows) => {
			setCustomModeList(rows)
		})
	}, [customModeManager])

	const fetchBuiltinModeOverrides = useCallback(async () => {
		customModeManager.listBuiltinModeOverrides().then((rows) => {
			setBuiltinModeOverrides(rows)
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
		void fetchBuiltinModeOverrides()
	}, [fetchCustomModeList, fetchBuiltinModeOverrides])

	const createCustomMode = useCallback(
		async (
			name: string,
			roleDefinition: string,
			customInstructions: string,
			tools: string[],
			icon?: string,
			enabled?: boolean
		): Promise<void> => {
			await customModeManager.createCustomMode({
				name,
				roleDefinition,
				customInstructions,
				tools,
				icon,
				enabled: enabled ?? true,
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
		async (id: string, name: string, roleDefinition: string, customInstructions: string, tools: string[], icon?: string, enabled?: boolean): Promise<void> => {
			await customModeManager.updateCustomMode(id, {
				name,
				roleDefinition,
				customInstructions,
				tools,
				icon,
				enabled,
			})
			fetchCustomModeList()
		},
		[customModeManager, fetchCustomModeList],
	)

	const toggleCustomModeEnabled = useCallback(
		async (id: string): Promise<void> => {
			const mode = customModeList.find(m => m.id === id)
			if (mode) {
				await customModeManager.updateCustomMode(id, {
					enabled: !mode.enabled,
				})
				fetchCustomModeList()
			}
		},
		[customModeManager, fetchCustomModeList, customModeList],
	)

	const FindCustomModeByName = useCallback(
		async (name: string): Promise<CustomMode | undefined> => {
			return customModeList.find((customMode) => customMode.name === name)
		}, [customModeList])

	// New builtin mode management functions
	const createOrUpdateBuiltinModeOverride = useCallback(
		async (
			slug: string,
			name: string,
			roleDefinition: string,
			customInstructions: string,
			tools: string[],
			icon?: string,
			enabled?: boolean
		): Promise<void> => {
			await customModeManager.createOrUpdateBuiltinModeOverride(slug, {
				name,
				roleDefinition,
				customInstructions,
				tools,
				icon,
				enabled,
			})
			await fetchBuiltinModeOverrides()
		},
		[customModeManager, fetchBuiltinModeOverrides],
	)

	const resetBuiltinModeToDefault = useCallback(
		async (slug: string): Promise<void> => {
			await customModeManager.resetBuiltinModeToDefault(slug)
			await fetchBuiltinModeOverrides()
		},
		[customModeManager, fetchBuiltinModeOverrides],
	)

	const isBuiltinModeOverridden = useCallback(
		(slug: string): boolean => {
			return builtinModeOverrides.some(override => override.slug === slug)
		},
		[builtinModeOverrides],
	)

	const getEffectiveBuiltinMode = useCallback(
		(slug: string): CustomMode | undefined => {
			// First check for override
			const override = builtinModeOverrides.find(override => override.slug === slug)
			if (override) {
				return override
			}

			// Fall back to default builtin mode (convert to CustomMode format)
			const builtinMode = defaultModes.find(mode => mode.slug === slug)
			if (builtinMode) {
				return {
					id: `builtin_${slug}`, // Temporary ID for builtin modes
					slug: builtinMode.slug,
					name: builtinMode.name,
					roleDefinition: builtinMode.roleDefinition,
					customInstructions: builtinMode.customInstructions || '',
					tools: builtinMode.tools,
					icon: builtinMode.icon || 'command',
					enabled: true, // Builtin modes are always enabled by default
					source: builtinMode.source || 'global',
					modeType: 'custom', // This will be ignored for display purposes
					isBuiltinOverride: false,
					updatedAt: 0,
					schemaVersion: 1,
				} as CustomMode
			}

			return undefined
		},
		[builtinModeOverrides],
	)

	return {
		createCustomMode,
		deleteCustomMode,
		updateCustomMode,
		toggleCustomModeEnabled,
		FindCustomModeByName,
		customModeList,
		customModePrompts,
		// New builtin mode management
		builtinModeOverrides,
		createOrUpdateBuiltinModeOverride,
		resetBuiltinModeToDefault,
		isBuiltinModeOverridden,
		getEffectiveBuiltinMode,
	}
}
