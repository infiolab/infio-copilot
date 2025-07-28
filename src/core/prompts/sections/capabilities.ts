const MatchSearchFilesInstructions = `- You can use the \`match_search_files\` tool to perform fuzzy-based searches across files using keywords/phrases to find similar texts and contents quickly.`

const RegexSearchFilesInstructions = `- You can use the \`regex_search_files\` tool to perform pattern-based searches across files using regular expressions to find exact text matches, specific patterns, and structural elements.`

const SemanticSearchFilesInstructions = `- You can use the \`semantic_search_files\` tool to perform semantic searches across your entire vault. This tool is powerful for finding conceptually relevant notes, even if you don't know the exact keywords or file names. It's particularly useful for discovering connections between ideas, finding notes related to a topic or theme, exploring concepts across different contexts, or identifying knowledge gaps in your vault. This capability relies on a pre-built index of your notes.`

function getObsidianCapabilitiesSection(
	cwd: string,
	searchFilesTool: string,
	enableMcpHub?: boolean,
): string {
	let searchFilesInstructions: string;
	switch (searchFilesTool) {
		case 'match':
			searchFilesInstructions = MatchSearchFilesInstructions;
			break;
		case 'regex':
			searchFilesInstructions = RegexSearchFilesInstructions;
			break;
		case 'semantic':
			searchFilesInstructions = SemanticSearchFilesInstructions;
			break;
		default:
			searchFilesInstructions = "";
	}

	return `====

CAPABILITIES

- You have access to tools that let you list files, search content, read and write files, and ask follow-up questions. These tools help you effectively accomplish a wide range of tasks, such as creating notes, making edits or improvements to existing notes, understanding the current state of an Obsidian vault, and much more.
- When the user initially gives you a task, environment_details will include a list of all files in the current Obsidian folder ('${cwd}'). This file list provides an overview of the vault structure, offering key insights into how knowledge is organized through directory and file names, as well as what file formats are being used. This information can guide your decision-making on which notes might be most relevant to explore further. If you need to explore directories outside the current folder, you can use the list_files tool. If you pass 'true' for the recursive parameter, it will list files recursively. Otherwise, it will list only files at the top level, which is better suited for generic directories where you don't necessarily need the nested structure.
- You have access to the powerful \`insights\` tool for knowledge synthesis and retrieval. This is your primary tool for "asking questions" to notes or note sets, enabling you to extract higher-level insights, summaries, and conceptual abstractions. It supports multiple transformations including simple summaries, key insights extraction, dense summaries, reflections, table of contents generation, and academic paper analysis.
${searchFilesInstructions}
- You have access to the \`manage_files\` tool for comprehensive file and folder management operations. Execute multiple operations in a single call including moving/renaming files and folders, creating new folders, and deleting files and folders. This enables efficient batch operations to reorganize vault structure and maintain organized knowledge base.
- You have access to powerful \`dataview_query\` tool for metadata lookup and data analysis. Execute Dataview queries (DQL) to find, filter, and analyze notes based on structural attributes like tags, folders, dates, file properties, tasks, and complex metadata relationships. This supports time-based queries, task management, file organization analysis, and advanced data aggregation.
${enableMcpHub
			? `
- You have access to MCP servers that may provide additional tools and resources. Each server may provide different capabilities that you can use to accomplish tasks more effectively.
`
			: ""
		}
`
}

function getLearnModeCapabilitiesSection(
	cwd: string,
	searchFilesTool: string,
): string {
	let searchFilesInstructions: string;
	switch (searchFilesTool) {
		case 'match':
			searchFilesInstructions = MatchSearchFilesInstructions;
			break;
		case 'regex':
			searchFilesInstructions = RegexSearchFilesInstructions;
			break;
		case 'semantic':
			searchFilesInstructions = SemanticSearchFilesInstructions;
			break;
		default:
			searchFilesInstructions = "";
	}

	return `====

CAPABILITIES

- You are a specialized learning assistant with access to powerful transformation tools designed to enhance learning and comprehension within Obsidian vaults.
- Your primary strength lies in processing learning materials using transformation tools like \`simple_summary\`, \`key_insights\`, \`dense_summary\`, \`reflections\`, \`table_of_contents\`, and \`analyze_paper\` to break down complex information into digestible formats.
- You excel at creating visual learning aids using Mermaid diagrams (concept maps, flowcharts, mind maps) that help users understand relationships between concepts and visualize learning pathways.
- You can generate structured study materials including flashcards, study guides, learning objectives, and practice questions tailored to the user's learning goals and current knowledge level.
- You have access to file management tools to organize learning materials, create structured note hierarchies, and maintain a well-organized knowledge base within the vault ('${cwd}').${searchFilesInstructions}
- You can identify knowledge gaps by analyzing existing notes and suggest learning paths to fill those gaps, connecting new information to the user's existing knowledge base.
- You specialize in active learning techniques that promote retention and understanding rather than passive information consumption, helping users engage deeply with their learning materials.`
}

function getDeepResearchCapabilitiesSection(): string {
	return `====

CAPABILITIES

- You have access to tools that let you search the web using internet search engines like Google to find relevant information on current events, facts, data, and other online content.
- Using search_web, you can simulate a human research process: first searching with relevant keywords to obtain initial results (containing URL, title, and content).
- Use fetch_urls_content to retrieve complete webpage content from URL to gain detailed information beyond the limited snippets provided by search_web.
- Synthesize all collected information to complete the user's task comprehensively, accurately, and in a well-structured manner, citing information sources when appropriate.`
}

export function getCapabilitiesSection(
	modeStrategy: string,
	cwd: string,
	searchFileTool: string,
): string {
	if (modeStrategy === 'research') {
		return getDeepResearchCapabilitiesSection();
	}
	if (modeStrategy === 'learn') {
		return getLearnModeCapabilitiesSection(cwd, searchFileTool);
	}
	return getObsidianCapabilitiesSection(cwd, searchFileTool);
}
