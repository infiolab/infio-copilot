import { createHash } from 'crypto'

import { App } from 'obsidian'
import { v4 as uuidv4 } from 'uuid'


import { AbstractJsonRepository } from '../base'
import { CONVERT_DATA_DIR, ROOT_DIR } from '../constants'

import {
	CONVERT_DATA_SCHEMA_VERSION,
	ConvertData,
	ConvertDataMetadata,
	ConvertType
} from './types'

export class ConvertDataManager extends AbstractJsonRepository<
	ConvertData,
	ConvertDataMetadata
> {
	constructor(app: App) {
		super(app, `${ROOT_DIR}/${CONVERT_DATA_DIR}`)
	}

	protected parseFileName(fileName: string): ConvertDataMetadata | null {
		// Check if filename is a valid MD5 hash (32 hex characters)
		const match = fileName.match(
			new RegExp(`^([a-f0-9]{32})\\.json$`),
		)
		if (!match) return null

		return {
			id: match[1],
			md5Hash: match[1],
			name: '',
			type: '',
			source: '',
			createdAt: 0,
			updatedAt: 0,
			schemaVersion: 0,
		}
	}

	protected generateFileName(data: ConvertData): string {
		// Format: {md5Hash}.json
		return `${data.md5Hash}.json`
	}

	/**
	 * 生成源的MD5哈希值
	 */
	public static generateSourceHash(source: string): string {
		return createHash('md5').update(source).digest('hex')
	}

	/**
	 * 创建转换数据记录
	 */
	public async createConvertData(
		convertData: Omit<
			ConvertData,
			'id' | 'md5Hash' | 'createdAt' | 'updatedAt' | 'schemaVersion'
		>,
	): Promise<ConvertData> {
		const md5Hash = ConvertDataManager.generateSourceHash(convertData.source)
		const now = Date.now()

		const newConvertData: ConvertData = {
			id: uuidv4(),
			md5Hash,
			...convertData,
			createdAt: now,
			updatedAt: now,
			schemaVersion: CONVERT_DATA_SCHEMA_VERSION,
		}

		await this.create(newConvertData)
		return newConvertData
	}

	/**
	 * 根据源查找转换数据
	 */
	public async findBySource(source: string): Promise<ConvertData | null> {
		const md5Hash = ConvertDataManager.generateSourceHash(source)
		return this.findByHash(md5Hash)
	}

	/**
	 * 根据MD5哈希查找转换数据
	 */
	public async findByHash(md5Hash: string): Promise<ConvertData | null> {
		const fileName = `${md5Hash}.json`
		
		try {
			return await this.read(fileName)
		} catch {
			return null
		}
	}

	/**
	 * 根据ID查找转换数据
	 */
	public async findById(id: string): Promise<ConvertData | null> {
		const allMetadata = await this.listMetadata()
		const targetMetadata = allMetadata.find((meta) => meta?.id === id)

		if (!targetMetadata) return null

		const fileName = `${targetMetadata.md5Hash}.json`

		try {
			return await this.read(fileName)
		} catch {
			return null
		}
	}

	/**
	 * 更新转换数据
	 */
	public async updateConvertData(
		id: string,
		updates: Partial<
			Omit<ConvertData, 'id' | 'md5Hash' | 'createdAt' | 'updatedAt' | 'schemaVersion'>
		>,
	): Promise<ConvertData | null> {
		const convertData = await this.findById(id)
		if (!convertData) return null

		const updatedConvertData: ConvertData = {
			...convertData,
			...updates,
			updatedAt: Date.now(),
		}

		await this.update(convertData, updatedConvertData)
		return updatedConvertData
	}

	/**
	 * 删除转换数据
	 */
	public async deleteConvertData(id: string): Promise<boolean> {
		const convertData = await this.findById(id)
		if (!convertData) return false

		const fileName = this.generateFileName(convertData)
		await this.delete(fileName)
		return true
	}

	/**
	 * 列出所有转换数据
	 */
	public async listConvertData(): Promise<ConvertData[]> {
		const allMetadata = await this.listMetadata()
		const allConvertData = await Promise.all(
			allMetadata.map(async (meta) => {
				if (!meta) return null
				
				const fileName = `${meta.md5Hash}.json`
				
				try {
					return await this.read(fileName)
				} catch {
					return null
				}
			})
		)
		
		return allConvertData
			.filter((data): data is ConvertData => data !== null)
			.sort((a, b) => b.updatedAt - a.updatedAt)
	}

	/**
	 * 根据类型列出转换数据
	 */
	public async listByType(type: ConvertType): Promise<ConvertData[]> {
		const allData = await this.listConvertData()
		return allData.filter((data) => data.type === type)
	}
} 
