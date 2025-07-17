import fuzzysort from 'fuzzysort'
import { App } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

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
