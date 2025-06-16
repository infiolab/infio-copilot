import { App, TFile  } from "obsidian";
import {
	MAX_RESULTS,
	//truncateLine,
	//buildLineIndexs,
	//findLineIndexBS,
	SearchResult,
	formatResults,
} from '../search-common';

type SearchMatchApi = {
	match: string;
	offset: number;
};

type ResultNoteApi = {
	score: number;
	vault: string;
	path: string;
	basename: string;
	foundWords: string[];
	matches: SearchMatchApi[];
	excerpt: string;
};

type OmnisearchApi = {
	search: (query: string) => Promise<ResultNoteApi[]>;
};

declare global {
	interface Window {
		omnisearch: OmnisearchApi;
	}
}

/**
 * Checks if the Omnisearch plugin's API is available.
 * @returns {boolean} True if the API is ready, false otherwise.
 */
function isOmnisearchAvailable(): boolean {
	return window.omnisearch && typeof window.omnisearch.search === "function";
}

/**
 * Searches using Omnisearch and builds context for each match.
 * @param query The search query for Omnisearch. Note: Omnisearch does not support regex.
 * @param app The Obsidian App instance.
 * @returns A formatted string of search results.
 */
export async function matchSearchUsingOmnisearch(
	query: string,
	app: App,
): Promise<string> {
	try {
		if (!isOmnisearchAvailable()) {
			throw new Error(
				"Omnisearch plugin not found or not active. Please install and enable it to use this search feature."
			);
		}

		// Omnisearch is not a regex engine.
		// The `query` will be treated as a keyword/fuzzy search by the plugin.
		const apiResults = await window.omnisearch.search(query);
		if (!apiResults) {
			throw new Error("Search results are not available.");
		}
		if (apiResults.length === 0) {
			return "No results found.";
		}

		const results: SearchResult[] = [];

		for (const noteResult of apiResults) {
			if (results.length >= MAX_RESULTS) {
				break;
			}
			if (!noteResult.matches || noteResult.matches.length === 0) {
				continue;
			}

            const lines = noteResult.excerpt.split('\n');
            lines.forEach((line, index) => {
				// Clean up null bytes to prevent PostgreSQL UTF8 encoding errors
                lines.splice(index, 1, line.replace(/\0/g, '').trimEnd());
            });

			results.push({
				file: noteResult.path,
				match: lines,
			});
		}

		if (results.length === 0) {
			return "No results found.";
		}

		return formatResults(results);
	} catch (error) {
		console.error("Error during Omnisearch processing:", error);
		return `An error occurred during the search: ${error}`;
	}
}