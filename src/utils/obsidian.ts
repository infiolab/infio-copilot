import * as path from 'path'

import { App, Editor, MarkdownView, TFile, TFolder, Vault, WorkspaceLeaf, loadPdfJs } from 'obsidian'

import { MentionableBlockData } from '../types/mentionable'

export async function parsePdfContent(file: TFile, app: App): Promise<string> {
	try {
		// 使用 Obsidian 内置的 PDF.js
		const pdfjsLib = await loadPdfJs()

		// Read PDF file as binary buffer
		const pdfBuffer = await app.vault.readBinary(file)

		// 使用 Obsidian 内置的 PDF.js 处理 PDF
		const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer })
		const doc = await loadingTask.promise
		let fullText = ''

		for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
			const page = await doc.getPage(pageNum)
			const textContent = await page.getTextContent()
			const pageText = textContent.items
				.map((item: any) => item.str)
				.join(' ')
			fullText += pageText + '\n\n'
		}

		// 清理null字节，防止PostgreSQL UTF8编码错误
		const cleanText = (fullText || '(Empty PDF content)').replace(/\0/g, '')
		return cleanText
	} catch (error: any) {
		console.error('Error parsing PDF:', error)
		return `(Error reading PDF file: ${error?.message || 'Unknown error'})`
	}
}

export async function readTFileContent(
	file: TFile,
	vault: Vault,
): Promise<string> {
	if (file.extension != 'md') {
		return "(Binary file, unable to display content)"
	}
	const content = await vault.cachedRead(file)
	// 清理null字节，防止PostgreSQL UTF8编码错误
	return content.replace(/\0/g, '')
}

export async function readTFileContentPdf(
	file: TFile,
	vault: Vault,
	app?: App,
): Promise<string> {
	if (file.extension === 'pdf') {
		if (app) {
			const content = await parsePdfContent(file, app)
			// 清理null字节，防止PostgreSQL UTF8编码错误
			return content.replace(/\0/g, '')
		}
		return "(PDF file, app context required for processing)"
	}
	if (file.extension != 'md') {
		return "(Binary file, unable to display content)"
	}
	const content = await vault.cachedRead(file)
	// 清理null字节，防止PostgreSQL UTF8编码错误
	return content.replace(/\0/g, '')
}

export async function readMultipleTFiles(
	files: TFile[],
	vault: Vault
): Promise<string[]> {
	// Read files in parallel
	const readPromises = files.map((file) => readTFileContent(file, vault))
	return await Promise.all(readPromises)
}

export function getNestedFiles(folder: TFolder, vault: Vault): TFile[] {
	const files: TFile[] = []
	for (const child of folder.children) {
		if (child instanceof TFile) {
			files.push(child)
		} else if (child instanceof TFolder) {
			files.push(...getNestedFiles(child, vault))
		}
	}
	return files
}

export async function getMentionableBlockData(
	editor: Editor,
	view: MarkdownView,
): Promise<MentionableBlockData | null> {
	const file = view.file
	if (!file) return null

	const selection = editor.getSelection()
	if (!selection) return null

	const startLine = editor.getCursor('from').line
	const endLine = editor.getCursor('to').line
	const selectionContent = editor
		.getValue()
		.split('\n')
		.slice(startLine, endLine + 1)
		.join('\n')

	return {
		content: selectionContent,
		file,
		startLine: startLine + 1, // +1 because startLine is 0-indexed
		endLine: endLine + 1, // +1 because startLine is 0-indexed
	}
}

export function getOpenFiles(app: App): TFile[] {
	try {
		const leaves = app.workspace.getLeavesOfType('markdown')

		return leaves
			.filter((v): v is WorkspaceLeaf & { view: MarkdownView & { file: TFile } } =>
				v.view instanceof MarkdownView && !!v.view.file
			)
			.map((v) => v.view.file)
	} catch (e) {
		return []
	}
}

export function calculateFileDistance(
	file1: TFile | TFolder,
	file2: TFile | TFolder,
): number | null {
	const path1 = file1.path.split('/')
	const path2 = file2.path.split('/')

	// Check if files are in different top-level folders
	if (path1[0] !== path2[0]) {
		return null
	}

	let distance = 0
	let i = 0

	// Find the common ancestor
	while (i < path1.length && i < path2.length && path1[i] === path2[i]) {
		i++
	}

	// Calculate distance from common ancestor to each file
	distance += path1.length - i
	distance += path2.length - i

	return distance
}

export function openMarkdownFile(
	app: App,
	filePath: string,
	startLine?: number,
) {
	const file = app.vault.getFileByPath(filePath)
	if (!file) return

	const existingLeaf = app.workspace
		.getLeavesOfType('markdown')
		.find(
			(leaf) =>
				leaf.view instanceof MarkdownView && leaf.view.file?.path === file.path,
		)

	if (existingLeaf) {
		app.workspace.setActiveLeaf(existingLeaf, { focus: true })

		if (startLine && existingLeaf.view instanceof MarkdownView) {
			existingLeaf.view.setEphemeralState({ line: startLine - 1 }) // -1 because line is 0-indexed
		}
	} else {
		const leaf = app.workspace.getLeaf('tab')
		leaf.openFile(file, {
			eState: startLine ? { line: startLine - 1 } : undefined, // -1 because line is 0-indexed
		})
	}
}

export async function openOrCreateMarkdownFile(
	app: App,
	filePath: string,
	startLine?: number,
) {
	const file_exists = await app.vault.adapter.exists(filePath)
	if (!file_exists) {
		const dir = path.dirname(filePath)
		const dir_exists = await app.vault.adapter.exists(dir)
		if (!dir_exists) {
			await app.vault.adapter.mkdir(dir)
		}
		await app.vault.adapter.write(filePath, '')
	}
	openMarkdownFile(app, filePath, startLine)
}
