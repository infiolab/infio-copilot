import * as path from "path"

// Constants
export const MAX_RESULTS = 300
export const MAX_LINE_LENGTH = 500

/**
 * Truncates a line around a specific matched area if it exceeds the maximum length.
 * This attempts to keep the characters around the startOffset and endOffset visible.
 *
 * @param line The line to truncate.
 * @param startOffset The starting character index of the matched area.
 * @param endOffset The ending character index of the matched area (defaults to startOffset).
 * @param maxLength The maximum allowed length (defaults to MAX_LINE_LENGTH).
 * @returns The truncated line, with truncation indicators if necessary, or the original line if it's shorter than maxLength or maxLength is less than 2.
 */
export function truncateLine(
	line: string,
	startOffset: number,
	endOffset?: number,
	maxLength: number = MAX_LINE_LENGTH
): string {
	if (line.length <= maxLength || maxLength < 2) {
		return line;
	}

	const focusStart = Math.clamp(startOffset, 0, line.length);
	const focusEnd = Math.clamp(endOffset ?? focusStart, focusStart, line.length - 1);
	const focusCentre = Math.floor((focusEnd - focusStart + 1) / 2);

	let sliceStart = Math.max(0, focusCentre - Math.floor(maxLength / 2))
	sliceStart = Math.min(sliceStart, focusStart, line.length - maxLength);
	const sliceEnd = Math.min(sliceStart + maxLength, line.length);

	return (
		(sliceStart > 0 ? "[...truncated] " : "") +
		line.substring(sliceStart, sliceEnd) +
		(sliceEnd < line.length ? " [truncated...]" : "")
	);
}

/**
 * Builds an array of character offsets representing the start of each line in a given array of lines.
 * This is used to quickly determine the line number and column number of a character offset within the text.
 *
 * @param lines An array of strings, where each string is a line of text.
 * @returns An array of numbers, where each number is the starting character offset of the corresponding line.
 */
export function buildLineIndexs(lines: string[]): number[] {
	const indexs: number[] = [];
	let currentOffset = 0;
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		indexs.push(currentOffset);

		currentOffset += line.length + 1;
	}
	return indexs;
}

export interface lineIndex {
	line: number;
	column: number;
}

/**
 * Finds the line index for a given character offset using binary search.
 * This is significantly more efficient than linear scanning for each match.
 *
 * @param offset The character offset of the match.
 * @param indexs An array where each element is the starting character offset of a line.
 * @returns The index of the line containing the offset.
 */
export function findLineIndexBS(indexs: number[], offset: number): lineIndex {
	let low = 0;
	let high = indexs.length - 1;
	let bestGuess = -1;
	while (low <= high) {
		const mid = Math.floor(low + (high - low) / 2);
		const midOffset = indexs[mid];

		if (midOffset <= offset) {
			bestGuess = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	const column = offset - indexs[bestGuess];
	return {
		line: bestGuess,
		column,
	};
}

export interface SearchResult {
	file: string
	match: string[]
	line?: number
	column?: number
	precedingContext?: string[]
	succeedingContext?: string[]
}

/**
 * Formats an array of search results into a LLM-friendly string output, grouped by file.
 *
 * @param results - An array of SearchResult objects.
 * @param cwd - The current working directory, used to make file paths relative.
 * @returns A formatted string representing the search results.
 */
export function formatResults(results: SearchResult[], cwd?: string): string {
	const groupedResults: { [key: string]: SearchResult[] } = {}

	let output = ""
	if (results.length >= MAX_RESULTS) {
		output += `Showing first ${MAX_RESULTS.toLocaleString()} of ${results.length.toLocaleString()} results. Use a more specific search if necessary.\n\n`
	} else {
		output += `Found ${results.length === 1 ? "1 result" : `${results.length.toLocaleString()} results`}.\n\n`
	}

	// Group results by file name
	results.slice(0, MAX_RESULTS).forEach((result) => {
		const relativeFilePath = cwd ? path.relative(cwd, result.file) : result.file;
		if (!groupedResults[relativeFilePath]) {
			groupedResults[relativeFilePath] = []
		}
		groupedResults[relativeFilePath].push(result)
	})

	for (const [filePath, fileResults] of Object.entries(groupedResults)) {
		output += `${filePath.toPosix()}\n│----\n`

		fileResults.forEach((result, index) => {
			const allLines: string[] = [];
			if (result.precedingContext) {
				allLines.push(...result.precedingContext);
			}
			allLines.push(...result.match);
			if (result.succeedingContext) {
				allLines.push(...result.succeedingContext);
			}

			allLines.forEach((line) => {
				output += `│${line?.trimEnd() ?? ""}\n`
			})

			if (index < fileResults.length - 1) {
				output += "│----\n"
			}
		})

		output += "│----\n\n"
	}

	return output.trim()
}