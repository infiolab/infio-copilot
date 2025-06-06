// @ts-nocheck

// 条件导入 Node.js 模块
let fs: any = null
let path: any = null

try {
	if (typeof window === 'undefined' || !(window as any).Platform?.isMobileApp) {
		fs = require("fs/promises")
		path = require("path")
	}
} catch (error) {
	console.log('移动端跳过 fs/path 模块导入:', error.message)
}

import { fileExistsAtPath } from "../../../utils/fs"
import { Mode } from "../../../utils/modes"

/**
 * Safely reads a file, returning an empty string if the file doesn't exist
 */
async function safeReadFile(filePath: string): Promise<string> {
	// 移动端不支持文件系统读取
	if (!fs) {
		console.log('移动端: safeReadFile 不可用')
		return ""
	}
	
	try {
		const content = await fs.readFile(filePath, "utf-8")
		// When reading with "utf-8" encoding, content should be a string
		return content.trim()
	} catch (err) {
		const errorCode = (err as NodeJS.ErrnoException).code
		if (!errorCode || !["ENOENT", "EISDIR"].includes(errorCode)) {
			throw err
		}
		return ""
	}
}

/**
 * Get the path to a system prompt file for a specific mode
 */
export function getSystemPromptFilePath(cwd: string, mode: Mode): string {
	return path.join(cwd, "_infio_prompts", `${mode}_system_prompt`)
}

/**
 * Loads custom system prompt from a file at _infio_prompts/system-prompt-[mode slug]
 * If the file doesn't exist, returns an empty string
 */
export async function loadSystemPromptFile(cwd: string, mode: Mode): Promise<string> {
	const filePath = getSystemPromptFilePath(cwd, mode)
	return safeReadFile(filePath)
}

/**
 * Ensures the _infio_prompts directory exists, creating it if necessary
 */
export async function ensureInfioPromptsDirectory(cwd: string): Promise<void> {
	const infioPromptsDir = path.join(cwd, "_infio_prompts")

	// Check if directory already exists
	if (await fileExistsAtPath(rooDir)) {
		return
	}

	// Create the directory
	try {
		await fs.mkdir(infioPromptsDir, { recursive: true })
	} catch (err) {
		// If directory already exists (race condition), ignore the error
		const errorCode = (err as NodeJS.ErrnoException).code
		if (errorCode !== "EEXIST") {
			throw err
		}
	}
}
