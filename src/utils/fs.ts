// 条件导入 Node.js 模块
let fs: any = null
let path: any = null

try {
	if (typeof window === 'undefined' || !(window as any).Platform?.isMobileApp) {
		fs = require("fs/promises")
		path = require("path")
	} else {
		// 移动端不支持文件系统操作
		fs = {
			mkdir: async () => { throw new Error('移动端不支持文件系统操作') },
			access: async () => { throw new Error('移动端不支持文件系统操作') }
		}
		path = {
			normalize: (p: string) => p,
			dirname: (p: string) => ''
		}
	}
} catch (error) {
	console.log('移动端跳过 fs 模块导入:', error.message)
}

/**
 * Asynchronously creates all non-existing subdirectories for a given file path
 * and collects them in an array for later deletion.
 *
 * @param filePath - The full path to a file.
 * @returns A promise that resolves to an array of newly created directories.
 */
export async function createDirectoriesForFile(filePath: string): Promise<string[]> {
	const newDirectories: string[] = []
	const normalizedFilePath = path.normalize(filePath) // Normalize path for cross-platform compatibility
	const directoryPath = path.dirname(normalizedFilePath)

	let currentPath = directoryPath
	const dirsToCreate: string[] = []

	// Traverse up the directory tree and collect missing directories
	while (!(await fileExistsAtPath(currentPath))) {
		dirsToCreate.push(currentPath)
		currentPath = path.dirname(currentPath)
	}

	// Create directories from the topmost missing one down to the target directory
	for (let i = dirsToCreate.length - 1; i >= 0; i--) {
		await fs.mkdir(dirsToCreate[i])
		newDirectories.push(dirsToCreate[i])
	}

	return newDirectories
}

/**
 * Helper function to check if a path exists.
 *
 * @param path - The path to check.
 * @returns A promise that resolves to true if the path exists, false otherwise.
 */
export async function fileExistsAtPath(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}
