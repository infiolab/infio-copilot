import { z } from "zod"

export const CONVERT_DATA_SCHEMA_VERSION = 1

export const convertTypeSchema = z.enum(['CONVERT_VIDEO', 'CONVERT_DOCUMENT'])

export type ConvertType = z.infer<typeof convertTypeSchema>

export const convertDataSchema = z.object({
	id: z.string().uuid("Invalid ID"),
	md5Hash: z.string().min(32, "MD5 hash must be 32 characters"), // 用于查询的md5
	name: z.string().min(1, "Name is required"), // url标题或文件名称
	type: convertTypeSchema, // CONVERT_VIDEO 或 CONVERT_DOCUMENT
	source: z.string().min(1, "Source is required"), // 转换源（视频链接或文件路径）
	contentPath: z.string().optional(), // 转换后存储的md文件路径，可能被移动
	content: z.string().min(1, "Content is required"), // 转换后的markdown文本
	createdAt: z.number().int().positive(),
	updatedAt: z.number().int().positive(),
	schemaVersion: z.literal(CONVERT_DATA_SCHEMA_VERSION),
})

export type ConvertData = z.infer<typeof convertDataSchema>

export type ConvertDataMetadata = {
	id: string
	md5Hash: string
	name: string
	type: string
	source: string
	createdAt: number
	updatedAt: number
	schemaVersion: number
} 
