import { App, TFile, View } from "obsidian";
import {
	MAX_RESULTS,
	truncateLine,
	buildLineIndexs,
	lineIndex,
	findLineIndexBS,
	SearchResult,
	formatResults,
} from '../search-common';

// A tuple representing the [start, end] character offsets of a match.
type MatchOffsetTuple = [number, number];

interface FileSearchResult {
	app: App
	children: any[]
	childrenEl: HTMLElement
	collapseEl: HTMLElement
	collapsed: boolean
	collapsible: boolean
	containerEl: HTMLElement
	content: string
	dom: any
	el: HTMLElement
	extraContext: () => boolean
	file: TFile
	info: any
	onMatchRender: any
	pusherEl: HTMLElement
	result: {
		filename?: MatchOffsetTuple[]
		content?: MatchOffsetTuple[]
	}
}

interface SearchDOM {
	resultDomLookup: Map<TFile, FileSearchResult>;
}

interface SearchView extends View {
	dom: SearchDOM;
}

/**
 * Searches using Obsidian's core search plugin and builds context for each match.
 *
 * @param app The Obsidian App instance.
 * @param query The query to search for.
 * @returns A promise that resolves to a formatted string of search results.
 */
export async function matchSearchUsingCorePlugin(
	query: string,
	app: App,
): Promise<string> {
	try {
		// @ts-ignore
		const searchPlugin = app.internalPlugins.plugins['global-search']?.instance;
		if (!searchPlugin) {
			throw new Error("Core search plugin is not available.");
		}

		// This function opens the search pane and executes the search.
		// It does not return the results directly.
		searchPlugin.openGlobalSearch(query);

		const getSearchResults = (): Map<TFile, FileSearchResult> | null => {
			const searchLeaf = app.workspace.getLeavesOfType('search')[0];
			if (!searchLeaf) {
				return null;
			}

			const searchView = searchLeaf.view as SearchView;
			if (searchView.dom?.resultDomLookup && searchView.dom.resultDomLookup.size > 0) {
				return searchView.dom.resultDomLookup;
			}
			return null;
		};

		const searchResultsMap = await new Promise<Map<TFile, FileSearchResult>>(resolve => {
			setTimeout(() => {
				const results = getSearchResults();
				resolve(results || new Map());
			}, 10000)
		});

		if (!searchResultsMap) {
			const searchLeaf = app.workspace.getLeavesOfType('search')[0];
			if (searchLeaf) {
				// @ts-ignore
				const searchInput = searchLeaf.view.searchQuery?.inputEl?.value;
				if (searchInput === query) {
					return "No results found.";
				}
			}
			throw new Error("Could not retrieve search results within the time limit.");
		}

		const results: SearchResult[] = [];
		for (const [file, fileMatches] of searchResultsMap.entries()) {
			if (results.length >= MAX_RESULTS) {
				break;
			}

			if (
				!file || !(file instanceof TFile) ||
				!fileMatches.content || fileMatches.content.length === 0
			) {
				continue;
			}
			const lines = fileMatches.content.split('\n');
			const indexs = buildLineIndexs(lines);

			for (const [startOffset, endOffset] of fileMatches.result.content) {
				if (results.length >= MAX_RESULTS) {
					break;
				}

				const lineIndexs: [lineIndex, lineIndex] = [
					findLineIndexBS(indexs, startOffset),
					findLineIndexBS(indexs, endOffset),
				];
				if (
					lineIndexs[0].line === -1 || lineIndexs[1].line === -1 ||
					lineIndexs[1].line < lineIndexs[0].line
				) { 
					continue;
				}

				const match = lines.slice(lineIndexs[0].line, lineIndexs[1].line + 1).join('\n').trimEnd();
				const columnStart = lineIndexs[0].column;
				const columnEnd = lineIndexs[1].column + (indexs[lineIndexs[1].line] - indexs[lineIndexs[0].line]);

				const finalLines = 
					truncateLine(match, columnStart, Math.min(columnEnd, match.length - 1)).split('\n');
				finalLines.forEach((line, index) => {
					finalLines.splice(index, 1, line.trimEnd());
				});

				results.push({
					file: file.path,
					match: finalLines,
					precedingContext:
						lineIndexs[0].line > 0
							? [truncateLine(lines[lineIndexs[0].line - 1].trimEnd(), 0)]
							: [],
					succeedingContext:
						lineIndexs[1].line < lines.length - 1
							? [truncateLine(lines[lineIndexs[1].line + 1].trimEnd(), 0)]
							: [],
				});
			}
		}

		if (results.length === 0) {
			return "No results found.";
		}

		return formatResults(results);
	} catch (error) {
		console.error("Error during core plugin processing:", error);
		return `An error occurred during the search: ${error}`;
	}
}
