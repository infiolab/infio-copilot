import { useCallback, useEffect, useMemo, useState } from 'react'

import { useApp } from '../contexts/AppContext'
import { CustomModeManager } from '../database/json/custom-mode/CustomModeManager'
import { CustomMode } from '../database/json/custom-mode/types'
import { ModeConfig, defaultModes } from '../utils/modes'

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
		strategy?: "ask" | "write" | "research" | "raw",
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
		strategy?: "ask" | "write" | "research" | "raw",
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
		strategy?: "ask" | "write" | "research" | "raw",
		icon?: string,
		enabled?: boolean
	) => Promise<void>
	resetBuiltinModeToDefault: (slug: string) => Promise<void>
	isBuiltinModeOverridden: (slug: string) => boolean
	getEffectiveBuiltinMode: (slug: string) => CustomMode | undefined
	// New method to get all effective modes for PromptGenerator
	getAllEffectiveModes: () => Promise<ModeConfig[]>
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
		const prompts: CustomModePrompts = {}

		// Add custom modes
		for (const customMode of customModeList) {
			prompts[customMode.slug] = {
				roleDefinition: customMode.roleDefinition,
				customInstructions: customMode.customInstructions,
			}
		}

		// Add builtin mode overrides
		for (const override of builtinModeOverrides) {
			prompts[override.slug] = {
				roleDefinition: override.roleDefinition,
				customInstructions: override.customInstructions,
			}
		}

		return prompts
	}, [customModeList, builtinModeOverrides])

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
			strategy?: "ask" | "write" | "research" | "raw",
			icon?: string,
			enabled?: boolean
		): Promise<void> => {
			await customModeManager.createCustomMode({
				name,
				roleDefinition,
				customInstructions,
				tools,
				strategy,
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
		async (id: string, name: string, roleDefinition: string, customInstructions: string, tools: string[], strategy?: "ask" | "write" | "research" | "raw", icon?: string, enabled?: boolean): Promise<void> => {
			await customModeManager.updateCustomMode(id, {
				name,
				roleDefinition,
				customInstructions,
				tools,
				strategy,
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
			strategy?: "ask" | "write" | "research" | "raw",
			icon?: string,
			enabled?: boolean
		): Promise<void> => {
			await customModeManager.createOrUpdateBuiltinModeOverride(slug, {
				name,
				roleDefinition,
				customInstructions,
				tools,
				strategy,
				icon,
				enabled,
			})
			await fetchBuiltinModeOverrides()
			// Also refresh custom mode list to ensure consistency
			await fetchCustomModeList()
		},
		[customModeManager, fetchBuiltinModeOverrides, fetchCustomModeList],
	)

	const resetBuiltinModeToDefault = useCallback(
		async (slug: string): Promise<void> => {
			await customModeManager.resetBuiltinModeToDefault(slug)
			await fetchBuiltinModeOverrides()
			// Also refresh custom mode list to ensure consistency
			await fetchCustomModeList()
		},
		[customModeManager, fetchBuiltinModeOverrides, fetchCustomModeList],
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
				const customMode: CustomMode = {
					id: `builtin_${slug}`, // Temporary ID for builtin modes
					slug: builtinMode.slug,
					name: builtinMode.name,
					roleDefinition: builtinMode.roleDefinition,
					customInstructions: builtinMode.customInstructions || '',
					tools: builtinMode.tools,
					strategy: builtinMode.strategy || "ask",
					icon: builtinMode.icon || 'command',
					enabled: true, // Builtin modes are always enabled by default
					source: builtinMode.source || 'global',
					modeType: 'custom', // This will be ignored for display purposes
					isBuiltinOverride: false,
					updatedAt: Date.now(),
					schemaVersion: 1,
				}
				return customMode
			}

			return undefined
		},
		[builtinModeOverrides],
	)

	const getAllEffectiveModes = useCallback(async (): Promise<ModeConfig[]> => {
		// 实时获取最新数据而不是依赖状态，避免异步状态更新导致的数据不一致问题
		const [currentCustomModeList, currentBuiltinModeOverrides] = await Promise.all([
			customModeManager.listCustomModesOnly(),
			customModeManager.listBuiltinModeOverrides()
		])

		const effectiveModes: ModeConfig[] = []

		// Add custom modes first (convert to ModeConfig format)
		effectiveModes.push(...currentCustomModeList.map(mode => ({
			slug: mode.slug,
			name: mode.name,
			icon: mode.icon,
			roleDefinition: mode.roleDefinition,
			customInstructions: mode.customInstructions,
			tools: mode.tools,
			strategy: mode.strategy,
			source: mode.source,
			enabled: mode.enabled,
		})))

		// Process builtin modes - add overrides or defaults
		for (const builtinMode of defaultModes) {
			// Skip if already exists in custom modes (to avoid duplicates)
			if (currentCustomModeList.some(cm => cm.slug === builtinMode.slug)) {
				continue
			}

			// Check if there's an override for this builtin mode
			const override = currentBuiltinModeOverrides.find(override => override.slug === builtinMode.slug)
			if (override) {
				// Use override configuration (convert to ModeConfig format)
				effectiveModes.push({
					slug: override.slug,
					name: override.name,
					icon: override.icon,
					roleDefinition: override.roleDefinition,
					customInstructions: override.customInstructions,
					tools: override.tools,
					strategy: override.strategy,
					source: override.source,
					enabled: override.enabled,
				})
			} else {
				// Use original builtin mode
				effectiveModes.push(builtinMode)
			}
		}
		console.log("getAllEffectiveModes", effectiveModes)
		return effectiveModes
	}, [customModeManager])

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
		// New method to get all effective modes for PromptGenerator
		getAllEffectiveModes,
	}
}
