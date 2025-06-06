import { App, FileSystemAdapter, normalizePath } from "obsidian"

import { diff_match_patch } from "diff-match-patch"

// 条件导入 Node.js 模块
let fs: any = null
let path: any = null
let simpleGit: any = null

try {
	if (typeof window === 'undefined' || !(window as any).Platform?.isMobileApp) {
		fs = require("fs")
		path = require("path")
		simpleGit = require("simple-git").default
	}
} catch (error) {
	console.log('移动端跳过 git 相关模块导入:', error.message)
}

import { validateEditResult } from "./search-strategies"
import { EditResult, Hunk } from "./types"


// // Helper function to infer indentation - simplified version
// function inferIndentation(line: string, contextLines: string[], previousIndent: string = ""): string {
// 	// If the line has explicit indentation in the change, use it exactly
// 	const lineMatch = line.match(/^(\s+)/)
// 	if (lineMatch) {
// 		return lineMatch[1]
// 	}

// 	// If we have context lines, use the indentation from the first context line
// 	const contextLine = contextLines[0]
// 	if (contextLine) {
// 		const contextMatch = contextLine.match(/^(\s+)/)
// 		if (contextMatch) {
// 			return contextMatch[1]
// 		}
// 	}

// 	// Fallback to previous indent
// 	return previousIndent
// }

// Context matching edit strategy
export function applyContextMatching(hunk: Hunk, content: string[], matchPosition: number): EditResult {
	if (matchPosition === -1) {
		return { confidence: 0, result: content, strategy: "context" }
	}

	const newResult = [...content.slice(0, matchPosition)]
	let sourceIndex = matchPosition

	for (const change of hunk.changes) {
		if (change.type === "context") {
			// Use the original line from content if available
			if (sourceIndex < content.length) {
				newResult.push(content[sourceIndex])
			} else {
				const line = change.indent ? change.indent + change.content : change.content
				newResult.push(line)
			}
			sourceIndex++
		} else if (change.type === "add") {
			// Use exactly the indentation from the change
			const baseIndent = change.indent || ""

			// Handle multi-line additions
			const lines = change.content.split("\n").map((line) => {
				// If the line already has indentation, preserve it relative to the base indent
				const lineIndentMatch = line.match(/^(\s*)(.*)/)
				if (lineIndentMatch) {
					const [, lineIndent, content] = lineIndentMatch
					// Only add base indent if the line doesn't already have it
					return lineIndent ? line : baseIndent + content
				}
				return baseIndent + line
			})

			newResult.push(...lines)
		} else if (change.type === "remove") {
			// Handle multi-line removes by incrementing sourceIndex for each line
			const removedLines = change.content.split("\n").length
			sourceIndex += removedLines
		}
	}

	// Append remaining content
	newResult.push(...content.slice(sourceIndex))

	// Calculate confidence based on the actual changes
	const afterText = newResult.slice(matchPosition, newResult.length - (content.length - sourceIndex)).join("\n")

	const confidence = validateEditResult(hunk, afterText)

	return {
		confidence,
		result: newResult,
		strategy: "context",
	}
}

// DMP edit strategy
export function applyDMP(hunk: Hunk, content: string[], matchPosition: number): EditResult {
	if (matchPosition === -1) {
		return { confidence: 0, result: content, strategy: "dmp" }
	}

	const dmp = new diff_match_patch()

	// Calculate total lines in before block accounting for multi-line content
	const beforeLineCount = hunk.changes
		.filter((change) => change.type === "context" || change.type === "remove")
		.reduce((count, change) => count + change.content.split("\n").length, 0)

	// Build BEFORE block (context + removals)
	const beforeLines = hunk.changes
		.filter((change) => change.type === "context" || change.type === "remove")
		.map((change) => {
			if (change.originalLine) {
				return change.originalLine
			}
			return change.indent ? change.indent + change.content : change.content
		})

	// Build AFTER block (context + additions)
	const afterLines = hunk.changes
		.filter((change) => change.type === "context" || change.type === "add")
		.map((change) => {
			if (change.originalLine) {
				return change.originalLine
			}
			return change.indent ? change.indent + change.content : change.content
		})

	// Convert to text with proper line endings
	const beforeText = beforeLines.join("\n")
	const afterText = afterLines.join("\n")

	// Create and apply patch
	const patch = dmp.patch_make(beforeText, afterText)
	const targetText = content.slice(matchPosition, matchPosition + beforeLineCount).join("\n")
	const [patchedText] = dmp.patch_apply(patch, targetText)

	// Split result and preserve line endings
	const patchedLines = patchedText.split("\n")

	// Construct final result
	const newResult = [
		...content.slice(0, matchPosition),
		...patchedLines,
		...content.slice(matchPosition + beforeLineCount),
	]

	const confidence = validateEditResult(hunk, patchedText)

	return {
		confidence,
		result: newResult,
		strategy: "dmp",
	}
}

// Git fallback strategy that works with full content
export async function applyGitFallback(app: App, hunk: Hunk, content: string[]): Promise<EditResult> {
	// 移动端不支持 Git 操作
	if (!fs || !path || !simpleGit) {
		console.log('移动端: Git 回退策略不可用')
		return { confidence: 0, result: content, strategy: "git-fallback" }
	}

	// let tmpDir: tmp.DirResult | undefined
	const adapter = app.vault.adapter as FileSystemAdapter;
	const vaultBasePath = adapter.getBasePath();
	const tmpGitPath = normalizePath(path.join(vaultBasePath, ".tmp_git"));

	// console.log("tmpGitPath", tmpGitPath)

	try {
		const exists = await adapter.exists(tmpGitPath);
		if (exists) {
			await adapter.rmdir(tmpGitPath, true);
		}
		await adapter.mkdir(tmpGitPath);
		// tmpDir = tmp.dirSync({ unsafeCleanup: true })
		const git: any = simpleGit(tmpGitPath)

		await git.init()
		await git.addConfig("user.name", "Temp")
		await git.addConfig("user.email", "temp@example.com")

		const filePath = path.join(tmpGitPath, "file.txt")

		const searchLines = hunk.changes
			.filter((change) => change.type === "context" || change.type === "remove")
			.map((change) => change.originalLine || change.indent + change.content)

		const replaceLines = hunk.changes
			.filter((change) => change.type === "context" || change.type === "add")
			.map((change) => change.originalLine || change.indent + change.content)

		const searchText = searchLines.join("\n")
		const replaceText = replaceLines.join("\n")
		const originalText = content.join("\n")

		try {
			fs.writeFileSync(filePath, originalText)
			await git.add("file.txt")
			const originalCommit = await git.commit("original")
			// console.log("Strategy 1 - Original commit:", originalCommit.commit)

			fs.writeFileSync(filePath, searchText)
			await git.add("file.txt")
			// const searchCommit1 = await git.commit("search")
			// console.log("Strategy 1 - Search commit:", searchCommit1.commit)

			fs.writeFileSync(filePath, replaceText)
			await git.add("file.txt")
			const replaceCommit = await git.commit("replace")
			// console.log("Strategy 1 - Replace commit:", replaceCommit.commit)

			// console.log("Strategy 1 - Attempting checkout of:", originalCommit.commit)
			await git.raw(["checkout", originalCommit.commit])
			try {
				// console.log("Strategy 1 - Attempting cherry-pick of:", replaceCommit.commit)
				await git.raw(["cherry-pick", "--minimal", replaceCommit.commit])

				const newText = fs.readFileSync(filePath, "utf-8")
				const newLines = newText.split("\n")
				return {
					confidence: 1,
					result: newLines,
					strategy: "git-fallback",
				}
			} catch (cherryPickError) {
				console.error("Strategy 1 failed with merge conflict")
			}
		} catch (error) {
			console.error("Strategy 1 failed:", error)
		}

		try {
			await git.init()
			await git.addConfig("user.name", "Temp")
			await git.addConfig("user.email", "temp@example.com")

			fs.writeFileSync(filePath, searchText)
			await git.add("file.txt")
			const searchCommit = await git.commit("search")
			const searchHash = searchCommit.commit.replace(/^HEAD /, "")
			// console.log("Strategy 2 - Search commit:", searchHash)

			fs.writeFileSync(filePath, replaceText)
			await git.add("file.txt")
			const replaceCommit = await git.commit("replace")
			const replaceHash = replaceCommit.commit.replace(/^HEAD /, "")
			// console.log("Strategy 2 - Replace commit:", replaceHash)

			// console.log("Strategy 2 - Attempting checkout of:", searchHash)
			await git.raw(["checkout", searchHash])
			fs.writeFileSync(filePath, originalText)
			await git.add("file.txt")
			// const originalCommit2 = await git.commit("original")
			// console.log("Strategy 2 - Original commit:", originalCommit2.commit)

			try {
				// console.log("Strategy 2 - Attempting cherry-pick of:", replaceHash)
				await git.raw(["cherry-pick", "--minimal", replaceHash])

				const newText = fs.readFileSync(filePath, "utf-8")
				const newLines = newText.split("\n")
				return {
					confidence: 1,
					result: newLines,
					strategy: "git-fallback",
				}
			} catch (cherryPickError) {
				console.error("Strategy 2 failed with merge conflict")
			}
		} catch (error) {
			console.error("Strategy 2 failed:", error)
		}

		console.error("Git fallback failed")
		return { confidence: 0, result: content, strategy: "git-fallback" }
	} catch (error) {
		console.error("Git fallback strategy failed:", error)
		return { confidence: 0, result: content, strategy: "git-fallback" }
	} finally {
		if (tmpGitPath) {
			await adapter.rmdir(tmpGitPath, true);
		}
	}
}

// Main edit function that tries strategies sequentially
export async function applyEdit(
	app: App,
	hunk: Hunk,
	content: string[],
	matchPosition: number,
	confidence: number,
	confidenceThreshold: number = 0.97,
): Promise<EditResult> {
	// Don't attempt regular edits if confidence is too low
	if (confidence < confidenceThreshold) {
		console.warn(
			`Search confidence (${confidence}) below minimum threshold (${confidenceThreshold}), trying git fallback...`,
		)
		return applyGitFallback(app, hunk, content)
	}

	// Try each strategy in sequence until one succeeds
	const strategies = [
		{ name: "dmp", apply: () => applyDMP(hunk, content, matchPosition) },
		{ name: "context", apply: () => applyContextMatching(hunk, content, matchPosition) },
		{ name: "git-fallback", apply: () => applyGitFallback(app, hunk, content) },
	]

	// Try strategies sequentially until one succeeds
	for (const strategy of strategies) {
		const result = await strategy.apply()
		if (result.confidence >= confidenceThreshold) {
			return result
		}
	}

	return { confidence: 0, result: content, strategy: "none" }
}
