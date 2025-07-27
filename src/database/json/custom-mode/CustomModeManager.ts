import fuzzysort from 'fuzzysort'
import { App } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

import { defaultModes } from '../../../utils/modes'
import { AbstractJsonRepository } from '../base'
import { CUSTOM_MODE_DIR, ROOT_DIR } from '../constants'
import {
	DuplicateCustomModeException,
	EmptyCustomModeNameException,
} from '../exception'

import { CUSTOM_MODE_SCHEMA_VERSION, CustomMode, CustomModeMetadata } from './types'

export class CustomModeManager extends AbstractJsonRepository<
	CustomMode,
	CustomModeMetadata
> {
	constructor(app: App) {
		super(app, `${ROOT_DIR}/${CUSTOM_MODE_DIR}`)
	}

	protected generateFileName(mode: CustomMode): string {
		// Format: v{schemaVersion}_name_id.json (with name encoded)
		const encodedName = encodeURIComponent(mode.name)
		return `v${CUSTOM_MODE_SCHEMA_VERSION}_${encodedName}_${mode.id}.json`
	}

	protected parseFileName(fileName: string): CustomModeMetadata | null {
		const regex = new RegExp(`^v${CUSTOM_MODE_SCHEMA_VERSION}_(.+)_([0-9a-f-]+)\\.json$`)
		const match = regex.exec(fileName)
		if (!match) return null

		const encodedName = match[1]
		const id = match[2]
		const name = decodeURIComponent(encodedName)

		return {
			id,
			name,
			updatedAt: Date.now(),
			schemaVersion: CUSTOM_MODE_SCHEMA_VERSION,
		}
	}

	public async createCustomMode(
		customMode: Omit<
			CustomMode,
			'id' | 'slug' | 'createdAt' | 'updatedAt' | 'schemaVersion'
		>,
	): Promise<CustomMode> {
		if (customMode.name !== undefined && customMode.name.length === 0) {
			throw new EmptyCustomModeNameException()
		}

		const existingCustomMode = await this.findByName(customMode.name)
		if (existingCustomMode) {
			throw new DuplicateCustomModeException(customMode.name)
		}

		const newCustomMode: CustomMode = {
			id: uuidv4(),
			...customMode,
			slug: customMode.name.toLowerCase().replace(/ /g, '-'),
			updatedAt: Date.now(),
			schemaVersion: CUSTOM_MODE_SCHEMA_VERSION,
		}

		await this.create(newCustomMode)
		return newCustomMode
	}

	public async ListCustomModes(): Promise<CustomMode[]> {
		const allMetadata = await this.listMetadata()
		const allCustomModes = await Promise.all(allMetadata.map(async (meta) => this.read(meta.fileName)))
		return allCustomModes.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	/**
	 * List only custom modes (exclude builtin overrides)
	 */
	public async listCustomModesOnly(): Promise<CustomMode[]> {
		const allModes = await this.ListCustomModes()
		return allModes.filter(mode => !mode.isBuiltinOverride)
	}

	/**
	 * List only builtin mode overrides
	 */
	public async listBuiltinModeOverrides(): Promise<CustomMode[]> {
		const allModes = await this.ListCustomModes()
		return allModes.filter(mode => mode.isBuiltinOverride)
	}

	public async findById(id: string): Promise<CustomMode | null> {
		const allMetadata = await this.listMetadata()
		const targetMetadata = allMetadata.find((meta) => meta.id === id)

		if (!targetMetadata) return null

		return this.read(targetMetadata.fileName)
	}

	public async findByName(name: string): Promise<CustomMode | null> {
		const allMetadata = await this.listMetadata()
		const targetMetadata = allMetadata.find((meta) => meta.name === name)

		if (!targetMetadata) return null

		return this.read(targetMetadata.fileName)
	}

	/**
	 * Find builtin mode override by slug
	 */
	public async findBuiltinModeOverride(slug: string): Promise<CustomMode | null> {
		const allModes = await this.ListCustomModes()
		return allModes.find(mode => mode.isBuiltinOverride && mode.slug === slug) || null
	}

	/**
	 * Check if a builtin mode has been overridden
	 */
	public async isBuiltinModeOverridden(slug: string): Promise<boolean> {
		const override = await this.findBuiltinModeOverride(slug)
		return override !== null
	}

	/**
	 * Create or update a builtin mode override
	 */
	public async createOrUpdateBuiltinModeOverride(
		slug: string,
		updates: Partial<Omit<CustomMode, 'id' | 'slug' | 'modeType' | 'isBuiltinOverride' | 'updatedAt' | 'schemaVersion'>>
	): Promise<CustomMode> {
		// Find the original builtin mode
		const builtinMode = defaultModes.find(mode => mode.slug === slug)
		if (!builtinMode) {
			throw new Error(`Builtin mode with slug '${slug}' not found`)
		}

		// Check if override already exists
		const existingOverride = await this.findBuiltinModeOverride(slug)
		
		if (existingOverride) {
			// Update existing override
			const updatedOverride: CustomMode = {
				...existingOverride,
				...updates,
				updatedAt: Date.now(),
			}
			await this.update(existingOverride, updatedOverride)
			return updatedOverride
		} else {
			// Create new override
			const newOverride: CustomMode = {
				id: uuidv4(),
				slug: slug,
				name: updates.name || builtinMode.name,
				roleDefinition: updates.roleDefinition || builtinMode.roleDefinition,
				customInstructions: updates.customInstructions || builtinMode.customInstructions,
				tools: updates.tools || builtinMode.tools,
				icon: updates.icon || builtinMode.icon,
				enabled: updates.enabled !== undefined ? updates.enabled : true,
				source: updates.source || 'global',
				modeType: 'builtin_override',
				isBuiltinOverride: true,
				updatedAt: Date.now(),
				schemaVersion: CUSTOM_MODE_SCHEMA_VERSION,
			}
			await this.create(newOverride)
			return newOverride
		}
	}

	/**
	 * Reset a builtin mode to its default configuration
	 */
	public async resetBuiltinModeToDefault(slug: string): Promise<boolean> {
		const existingOverride = await this.findBuiltinModeOverride(slug)
		if (!existingOverride) {
			return false // No override to reset
		}

		const fileName = this.generateFileName(existingOverride)
		await this.delete(fileName)
		return true
	}

	public async updateCustomMode(
		id: string,
		updates: Partial<
			Omit<CustomMode, 'id' | 'slug' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
		>,
	): Promise<CustomMode | null> {
		if (updates.name !== undefined && updates.name.length === 0) {
			throw new EmptyCustomModeNameException()
		}

		const customMode = await this.findById(id)
		if (!customMode) return null

		if (updates.name && updates.name !== customMode.name) {
			const existingCustomMode = await this.findByName(updates.name)
			if (existingCustomMode) {
				throw new DuplicateCustomModeException(updates.name)
			}
		}

		const updatedCustomMode: CustomMode = {
			...customMode,
			...updates,
			updatedAt: Date.now(),
		}

		await this.update(customMode, updatedCustomMode)
		return updatedCustomMode
	}

	public async deleteCustomMode(id: string): Promise<boolean> {
		const customMode = await this.findById(id)
		if (!customMode) return false

		const fileName = this.generateFileName(customMode)
		await this.delete(fileName)
		return true
	}

	public async searchCustomModes(query: string): Promise<CustomMode[]> {
		const allMetadata = await this.listMetadata()
		const results = fuzzysort.go(query, allMetadata, {
			keys: ['name'],
			threshold: 0.2,
			limit: 20,
			all: true,
		})

		const customModes = (
			await Promise.all(
				results.map(async (result) => this.read(result.obj.fileName)),
			)
		).filter((customMode): customMode is CustomMode => customMode !== null)

		return customModes
	}
}
