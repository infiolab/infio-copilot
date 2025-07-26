import fuzzysort from 'fuzzysort'
import { App } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'

import { AbstractJsonRepository } from '../base'
import { COMMAND_DIR, ROOT_DIR } from '../constants'
import {
	DuplicateCommandException,
	EmptyCommandNameException,
} from '../exception'

import { COMMAND_SCHEMA_VERSION, Command, CommandMetadata } from './types'

export class CommandManager extends AbstractJsonRepository<
	Command,
	CommandMetadata
> {
	constructor(app: App) {
		super(app, `${ROOT_DIR}/${COMMAND_DIR}`)
	}

	protected generateFileName(template: Command): string {
		// Format: v{schemaVersion}_name_id.json (with name encoded)
		const encodedName = encodeURIComponent(template.name)
		return `v${COMMAND_SCHEMA_VERSION}_${encodedName}_${template.id}.json`
	}

	protected parseFileName(fileName: string): CommandMetadata | null {
		const match = fileName.match(
			new RegExp(`^v${COMMAND_SCHEMA_VERSION}_(.+)_([0-9a-f-]+)\\.json$`),
		)
		if (!match) return null

		const encodedName = match[1]
		const id = match[2]
		const name = decodeURIComponent(encodedName)

		return { id, name, schemaVersion: COMMAND_SCHEMA_VERSION }
	}

	public async createCommand(
		command: Omit<
			Command,
			'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'
		>,
	): Promise<Command> {
		if (command.name !== undefined && command.name.length === 0) {
			throw new EmptyCommandNameException()
		}

		const existingCommand = await this.findByName(command.name)
		if (existingCommand) {
			throw new DuplicateCommandException(command.name)
		}

		const newCommand: Command = {
			id: uuidv4(),
			...command,
			createdAt: Date.now(),
			updatedAt: Date.now(),
			schemaVersion: COMMAND_SCHEMA_VERSION,
		}

		await this.create(newCommand)
		return newCommand
	}

	public async ListCommands(): Promise<Command[]> {
		const allMetadata = await this.listMetadata()
		const allCommands = await Promise.all(allMetadata.map(async (meta) => this.read(meta.fileName)))
		return allCommands.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	public async findById(id: string): Promise<Command | null> {
		const allMetadata = await this.listMetadata()
		const targetMetadata = allMetadata.find((meta) => meta.id === id)

		if (!targetMetadata) return null

		return this.read(targetMetadata.fileName)
	}

	public async findByName(name: string): Promise<Command | null> {
		const allMetadata = await this.listMetadata()
		const targetMetadata = allMetadata.find((meta) => meta.name === name)

		if (!targetMetadata) return null

		return this.read(targetMetadata.fileName)
	}

	public async updateCommand(
		id: string,
		updates: Partial<
			Omit<Command, 'id' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
		>,
	): Promise<Command | null> {
		if (updates.name !== undefined && updates.name.length === 0) {
			throw new EmptyCommandNameException()
		}

		const command = await this.findById(id)
		if (!command) return null

		if (updates.name && updates.name !== command.name) {
			const existingCommand = await this.findByName(updates.name)
			if (existingCommand) {
				throw new DuplicateCommandException(updates.name)
			}
		}

		const updatedCommand: Command = {
			...command,
			...updates,
			updatedAt: Date.now(),
		}

		await this.update(command, updatedCommand)
		return updatedCommand
	}

	public async deleteCommand(id: string): Promise<boolean> {
		const command = await this.findById(id)
		if (!command) return false

		const fileName = this.generateFileName(command)
		await this.delete(fileName)
		return true
	}

	public async searchCommands(query: string): Promise<Command[]> {
		const allMetadata = await this.listMetadata()
		const results = fuzzysort.go(query, allMetadata, {
			keys: ['name'],
			threshold: 0.2,
			limit: 20,
			all: true,
		})

		const commands = (
			await Promise.all(
				results.map(async (result) => this.read(result.obj.fileName)),
			)
		).filter((command): command is Command => command !== null)

		return commands
	}

	public async toggleStarCommand(id: string): Promise<Command | null> {
		const command = await this.findById(id)
		if (!command) return null

		const updatedCommand: Command = {
			...command,
			starred: !command.starred,
			updatedAt: Date.now(),
		}

		await this.update(command, updatedCommand)
		return updatedCommand
	}

	public async getStarredCommands(): Promise<Command[]> {
		const allCommands = await this.ListCommands()
		return allCommands.filter(command => command.starred === true)
	}
}
