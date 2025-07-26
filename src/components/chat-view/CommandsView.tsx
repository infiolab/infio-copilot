import { $generateNodesFromSerializedNodes } from '@lexical/clipboard'
import { BaseSerializedNode } from '@lexical/clipboard/clipboard'
import { InitialEditorStateType } from '@lexical/react/LexicalComposer'
import { $getRoot, $insertNodes, LexicalEditor } from 'lexical'
import { ChevronDown, ChevronRight, Download, Pencil, Search, Star, Trash2 } from 'lucide-react'
import { Notice } from 'obsidian'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { TemplateContent } from '../../database/schema'
import { useCommands } from '../../hooks/use-commands'
import { IconSelector, getIconComponent } from '../../hooks/use-icon-selector'
import { t } from '../../lang/helpers'

import LexicalContentEditable from './chat-input/LexicalContentEditable'

export interface QuickCommand {
	id: string
	name: string
	content: TemplateContent
	contentText: string
	icon?: string
	starred?: boolean
	createdAt: number
	updatedAt: number
}

// 市场命令示例数据
interface MarketCommand {
	id: string
	name: string
	description: string
	contentText: string
	category: string
	icon: string
	downloads?: number
}

const marketCommands: MarketCommand[] = [
	{
		id: 'review-weekly',
		name: 'review-weekly',
		description: 'Generate a concise weekly review report',
		contentText: `First, use your \`dataview\` tool to query my vault for activity in the **last 7 days**, finding:
1.  All **newly created files**.
2.  All **tasks**, both new and completed.

**Crucial Query Instruction**: When finding tasks, only include lines that explicitly start with \`- []\` or \` - [x]\`. You **must exclude** lines that are bibliographic citations (e.g., \`[1] Author...\`) and are not actual to-do items.

Based **strictly** on the data you retrieve, use \`attempt_completion\` generate this concise report:

*   **1. Weekly Focus & Highlights**:
    *   What were my primary themes based on new files and tasks?
    *   Identify 3-6 most significant completed tasks and their impact.

*   **2. Productivity Snapshot**:
    *   **Metrics**: Tasks Added, Completed, Remaining.
    *   **Evaluation**: Briefly assess my workload and mention any visible bottlenecks from the remaining tasks.

*   **3. Next Week's Action Plan**:
    *   List the top 6 incomplete tasks as priorities.
    *   Suggest if any other tasks could be **delegated or delayed**.`,
		category: 'review',
		icon: 'calendar',
		downloads: 1250
	},
	{
		id: 'translate',
		name: 'translate',
		description: 'Translate user-provided text',
		contentText: 'Translate user-provided text accurately, naturally, and contextually into fluent **简体中文**.',
		category: 'translate',
		icon: 'languages',
		downloads: 890
	},
	{
		id: 'continue-writing',
		name: 'continue-writing',
		description: 'Continue writing the user-provided text',
		contentText: `Extend the user-provided story segment. Your continuation must be an indistinguishable and natural progression of the original, meticulously maintaining its established voice, style, tone, characters, plot trajectory, and original language.

**Core Directives for Your Continuation:**

1.  **Character Authenticity:** Ensure all character actions, dialogue, and internal thoughts remain strictly consistent with their established personalities and development.
2.  **Plot Cohesion & Progression:** Build organically upon existing plot points. New developments must be plausible within the story's universe, advance the narrative meaningfully, add depth, and keep the reader engaged.
3.  **Voice & Style Replication:** Perfectly mimic the original author's narrative voice, writing style, vocabulary, pacing, and tone. The continuation must flow so smoothly that it feels written by the same hand.
4.  **Original Language Adherence:** The entire continuation must be in the same language as the provided text.`,
		category: 'write',
		icon: 'edit',
		downloads: 2100
	},
	{
		id: 'improve-writing',
		name: 'improve-writing',
		description: 'Improve the user-provided text',
		contentText: `Revise and enhance the provided text with attention to the following key aspects:
- **Clarity and Impact:** Ensure the message is easy to understand and delivers a strong impression.
- **Flow and Structure:** Organize sentences and paragraphs so that ideas connect smoothly and logically.
- **Grammar and Wording:** Correct any grammatical errors and use precise, effective language.

While rewriting, you must:
- **Preserve Core Meaning:** Maintain the original intent and message.
- **Match the Tone:** Ensure the rewritten text reflects the same style and tone (e.g., professional, casual) as the original.
- **Retain Proper Nouns:** Do not modify names of people, places, or specific products.`,
		category: 'write',
		icon: 'lightbulb',
		downloads: 756
	},
	{
		id: 'generate-outline',
		name: 'generate-outline',
		description: 'Generate a detailed outline',
		contentText: `Generate a detailed outline for the user-provided text based on the provided theme. Include: 1. Main sections, 2. Key points for each section, 3. Logical structure.`,
		category: 'write',
		icon: 'wand',
		downloads: 432
	},
	{
		id: 'brainstorm',
		name: 'brainstorm',
		description: 'Brainstorm ideas for the user-provided text.',
		contentText: `Based on the core theme, subject, or information within the user-provided content, generate a diverse and imaginative set of brainstormed ideas.

1. **Creative Ideation & Exploration:**
    * **Deep Dive:** Thoroughly analyze the user's provided content to grasp its central concepts, underlying potential, and any unstated opportunities.
    * **Diverse Angles:** Generate a range of distinct ideas. Explore various perspectives, applications, creative interpretations, or extensions related to the provided content.
    * **Emphasis on Creativity:** Prioritize originality, novelty, and "out-of-the-box" thinking. The goal is to provide fresh and inspiring suggestions.

2. **Structured Idea Presentation (For Each Idea):**
    * **Main Concept:** Clearly state the overarching idea or main concept as a top-level bullet point.
    * **Elaborating Details:** Beneath each main concept, provide 2-3 nested sub-bullet points that offer specific details. These details should clarify or expand upon the main concept and could include:
        * Potential execution approaches or unique features.
        * Specific examples, scenarios, or elaborations.
        * Considerations for target audience, potential impact, or next steps.
        * Unique selling propositions or differentiating factors.`,
		category: 'ask',
		icon: 'brain',
		downloads: 123
	},
	{
		id: 'fix-spelling',
		name: 'fix-spelling',
		description: 'Fix spelling errors in the user-provided text.',
		contentText: `Review the provided text and correct spelling errors.

**Your Actions:**
*   Identify and fix misspelled words.
*   Correct obvious typographical errors (e.g., "teh" to "the").

**Strict Rules:**
*   **Do Not Alter Content:** The meaning, grammar, and choice of words must not be changed.
*   **Maintain Original Formatting:** Your output must perfectly mirror the input's structure, including all line breaks, indentation, and spacing.`,
		category: 'write',
		icon: 'check',
		downloads: 123
	},
	{
		id: 'fix-grammar',
		name: 'fix-grammar',
		description: 'Fix grammar errors in the user-provided text.',
		contentText: `Please correct the grammar of the content provided by user to ensure it complies with the grammatical conventions of the language it belongs to, contains no grammatical errors, maintains correct sentence structure, uses tenses accurately, and has correct punctuation. Please ensure that the final content is grammatically impeccable while retaining the original information.`,
		category: 'write',
		icon: 'check',
		downloads: 123
	},
	{
		id: 'fix-punctuation',
		name: 'fix-punctuation',
		description: 'Fix punctuation errors in the user-provided text.',
		contentText: `Please correct the punctuation of the content provided by user to ensure it complies with the punctuation conventions of the language it belongs to, contains no punctuation errors, maintains correct sentence structure, and has correct punctuation. Please ensure that the final content is punctually impeccable while retaining the original information.`,
		category: 'write',
		icon: 'check',
		downloads: 123
	}
]

const CommandsView = (
	{
		selectedSerializedNodes
	}: {
		selectedSerializedNodes?: BaseSerializedNode[]
	}
) => {
	const {
		createCommand,
		deleteCommand,
		updateCommand,
		toggleStarCommand,
		commandList,
	} = useCommands()

	// tab state
	const [activeTab, setActiveTab] = useState<'my-commands' | 'market'>('my-commands')

	// new command name
	const [newCommandName, setNewCommandName] = useState('')

	// new command icon
	const [newCommandIcon, setNewCommandIcon] = useState<string>('square-slash')

	// search term
	const [searchTerm, setSearchTerm] = useState('')

	// editing command id
	const [editingCommandId, setEditingCommandId] = useState<string | null>(null)

	// editing command icon
	const [editingCommandIcon, setEditingCommandIcon] = useState<string>('command')

	// create new command section expanded state
	const [isCreateSectionExpanded, setIsCreateSectionExpanded] = useState(false)

	const nameInputRefs = useRef<Map<string, HTMLInputElement>>(new Map())
	const contentEditorRefs = useRef<Map<string, LexicalEditor>>(new Map())

	// create refs for each command
	const commandEditRefs = useRef<Map<string, {
		editorRef: React.RefObject<LexicalEditor>,
		contentEditableRef: React.RefObject<HTMLDivElement>
	}>>(new Map());

	// get or create command edit refs
	const getCommandEditRefs = useCallback((id: string) => {
		if (!commandEditRefs.current.has(id)) {
			commandEditRefs.current.set(id, {
				editorRef: React.createRef<LexicalEditor>(),
				contentEditableRef: React.createRef<HTMLDivElement>()
			});
		}
		// 由于之前的if语句确保了值存在，所以这里不会返回undefined
		const refs = commandEditRefs.current.get(id);
		if (!refs) {
			// 添加保险逻辑，创建一个新的refs对象
			const newRefs = {
				editorRef: React.createRef<LexicalEditor>(),
				contentEditableRef: React.createRef<HTMLDivElement>()
			};
			commandEditRefs.current.set(id, newRefs);
			return newRefs;
		}
		return refs;
	}, []);

	// update command edit refs when editing command id changes
	useEffect(() => {
		if (editingCommandId) {
			const refs = getCommandEditRefs(editingCommandId);
			if (refs.editorRef.current) {
				contentEditorRefs.current.set(editingCommandId, refs.editorRef.current);
			}
		}
	}, [editingCommandId, getCommandEditRefs]);

	// new command content's editor state
	const initialEditorState: InitialEditorStateType = (
		editor: LexicalEditor,
	) => {
		if (!selectedSerializedNodes) return
		editor.update(() => {
			const parsedNodes = $generateNodesFromSerializedNodes(
				selectedSerializedNodes,
			)
			$insertNodes(parsedNodes)
		})
	}
	// new command content's editor
	const editorRef = useRef<LexicalEditor>(null)
	// new command content's editable
	const contentEditableRef = useRef<HTMLDivElement>(null)

	// toggle create section expansion
	const toggleCreateSectionExpansion = () => {
		setIsCreateSectionExpanded(prev => !prev)
	}

	// Create new command
	const handleAddCommand = async () => {
		const serializedEditorState = editorRef.current.toJSON()
		const nodes = serializedEditorState.editorState.root.children
		if (nodes.length === 0) {
			new Notice(String(t('command.errorContentRequired')))
			return
		}
		if (newCommandName.trim().length === 0) {
			new Notice(String(t('command.errorNameRequired')))
			return
		}
		
		await createCommand(newCommandName, { nodes }, newCommandIcon)

		// clear editor content
		editorRef.current.update(() => {
			const root = $getRoot()
			root.clear()
		})
		setNewCommandName('')
		setNewCommandIcon('command')
		setIsCreateSectionExpanded(false)
	}

	// delete command
	const handleDeleteCommand = async (id: string) => {
		await deleteCommand(id)
	}

	// edit command
	const handleEditCommand = (command: QuickCommand) => {
		setEditingCommandId(command.id)
		setEditingCommandIcon(command.icon || 'command')
	}

	// save edited command
	const handleSaveEdit = async (id: string) => {
		const nameInput = nameInputRefs.current.get(id)
		const currContentEditorRef = contentEditorRefs.current.get(id)
		if (!currContentEditorRef) {
			new Notice(String(t('command.errorContentRequired')))
			return
		}
		const serializedEditorState = currContentEditorRef.toJSON()
		const nodes = serializedEditorState.editorState.root.children
		if (nodes.length === 0) {
			new Notice(String(t('command.errorContentRequired')))
			return
		}
		await updateCommand(
			id,
			nameInput.value,
			{ nodes },
			editingCommandIcon
		)
		setEditingCommandId(null)
		setEditingCommandIcon('command')
	}

	// handle search
	const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
		setSearchTerm(e.target.value)
	}

	// filter commands list
	const filteredCommands = useMemo(() => {
		if (!searchTerm.trim()) {
			return commandList;
		}
		return commandList.filter(
			command =>
				command.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				command.contentText.toLowerCase().includes(searchTerm.toLowerCase())
		);
	}, [commandList, searchTerm]);

	// filter market commands
	const filteredMarketCommands = useMemo(() => {
		if (!searchTerm.trim()) {
			return marketCommands;
		}
		return marketCommands.filter(
			command =>
				command.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
				command.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
				command.contentText.toLowerCase().includes(searchTerm.toLowerCase()) ||
				command.category.toLowerCase().includes(searchTerm.toLowerCase())
		);
	}, [searchTerm]);

	const getCommandEditorState = (commandContent: TemplateContent): InitialEditorStateType => {
		return (editor: LexicalEditor) => {
			editor.update(() => {
				const parsedNodes = $generateNodesFromSerializedNodes(
					commandContent.nodes,
				)
				$insertNodes(parsedNodes)
			})
		}
	}

	// install market command
	const handleInstallMarketCommand = async (marketCommand: MarketCommand) => {
		// Create a simple paragraph node with text content
		const paragraphNode = {
			children: [
				{
					detail: 0,
					format: 0,
					mode: 'normal',
					style: '',
					text: marketCommand.contentText,
					type: 'text',
					version: 1,
				}
			],
			direction: 'ltr' as const,
			format: '',
			indent: 0,
			type: 'paragraph',
			version: 1,
		}

		const templateContent: TemplateContent = {
			nodes: [paragraphNode]
		}
		
		await createCommand(marketCommand.name, templateContent, marketCommand.icon)
		new Notice(`已安装命令: ${marketCommand.name}`)
	}

	// toggle star for command
	const handleToggleStar = async (id: string) => {
		await toggleStarCommand(id)
	}

	return (
		<div className="infio-commands-container">
			{/* header */}
			<div className="infio-commands-header">
				<h2 className="infio-commands-header-title">{t('command.createQuickCommand')}</h2>
			</div>

			{/* tabs */}
			<div className="infio-commands-tabs">
				<button
					className={`infio-commands-tab-button ${activeTab === 'my-commands' ? 'active' : ''}`}
					onClick={() => setActiveTab('my-commands')}
				>
					我的命令 ({commandList.length})
				</button>
				<button
					className={`infio-commands-tab-button ${activeTab === 'market' ? 'active' : ''}`}
					onClick={() => setActiveTab('market')}
				>
					市场 ({marketCommands.length})
				</button>
			</div>

			{/* tab content */}
			<div className="infio-commands-tab-content">
				{activeTab === 'my-commands' && (
					<>
						{/* Create New Command Section */}
						<div className="infio-commands-create-section">
							<div className="infio-commands-create-item">
								<div className="infio-commands-create-item-header" onClick={toggleCreateSectionExpansion}>
									<div className="infio-commands-create-item-info">
										<div className="infio-commands-hub-expander">
											{isCreateSectionExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
										</div>
										<h3 className="infio-commands-create-title">自定义命令</h3>
									</div>
								</div>

								{isCreateSectionExpanded && (
									<div className="infio-commands-create-expanded">
										<div className="infio-commands-form-row">
											<div className="infio-commands-form-group infio-commands-icon-group">
												<IconSelector
													selectedIcon={newCommandIcon}
													onIconSelect={setNewCommandIcon}
													className="infio-commands-icon-selector"
													size={16}
												/>
											</div>
											<div className="infio-commands-form-group">
												<input
													type="text"
													value={newCommandName}
													placeholder={t('command.name')}
													onChange={(e) => setNewCommandName(e.target.value)}
													className="infio-commands-input"
												/>
											</div>
										</div>
										<div className="infio-commands-textarea">
											<LexicalContentEditable
												initialEditorState={initialEditorState}
												editorRef={editorRef}
												contentEditableRef={contentEditableRef}
											/>
										</div>
										<button
											onClick={handleAddCommand}
											className="infio-commands-add-btn"
											disabled={!newCommandName.trim()}
										>
											<span>{t('command.createCommand')}</span>
										</button>
									</div>
								)}
							</div>
						</div>

						{/* search bar */}
						<div className="infio-commands-search">
							<Search size={18} className="infio-commands-search-icon" />
							<input
								type="text"
								placeholder={t('command.searchPlaceholder')}
								value={searchTerm}
								onChange={handleSearch}
								className="infio-commands-search-input"
							/>
						</div>

						{/* commands list */}
						<div className="infio-commands-list">
							{filteredCommands.length === 0 ? (
								<div className="infio-commands-empty">
									<p>{t('command.noCommandsFound')}</p>
								</div>
							) : (
								filteredCommands.map(command => (
									<div key={command.name} className="infio-commands-item">
										{editingCommandId === command.id ? (
											// edit mode
											<div className="infio-commands-edit-mode">
												<div className="infio-commands-form-row">
													<div className="infio-commands-form-group infio-commands-icon-group">
														<IconSelector
															selectedIcon={editingCommandIcon}
															onIconSelect={setEditingCommandIcon}
															className="infio-commands-icon-selector"
															size={16}
														/>
													</div>
													<div className="infio-commands-form-group">
														<input
															type="text"
															defaultValue={command.name}
															className="infio-commands-edit-name"
															ref={(el) => {
																if (el) nameInputRefs.current.set(command.id, el)
															}}
														/>
													</div>
												</div>
												<div className="infio-commands-textarea">
													<LexicalContentEditable
														initialEditorState={getCommandEditorState(command.content)}
														editorRef={getCommandEditRefs(command.id).editorRef}
														contentEditableRef={getCommandEditRefs(command.id).contentEditableRef}
													/>
												</div>
												<div className="infio-commands-actions">
													<button
														onClick={() => handleSaveEdit(command.id)}
														className="infio-commands-add-btn"
													>
														<span>{t('command.updateCommand')}</span>
													</button>
												</div>
											</div>
										) : (
											// view mode
											<div className="infio-commands-view-mode">
												<div className="infio-commands-item-header">
													<div className="infio-commands-name">
														{(() => {
															const IconComponent = getIconComponent(command.icon)
															return <IconComponent size={16} />
														})()}
														<span>{command.name}</span>
														{command.starred && <Star size={14} fill="gold" color="gold" />}
													</div>
													<div className="infio-commands-actions">
														<button
															onClick={() => handleToggleStar(command.id)}
															className="infio-commands-btn"
															title={command.starred ? "取消收藏" : "收藏命令"}
														>
															<Star size={16} fill={command.starred ? "gold" : "none"} color={command.starred ? "gold" : "currentColor"} />
														</button>
														<button
															onClick={() => handleEditCommand(command)}
															className="infio-commands-btn"
														>
															<Pencil size={16} />
														</button>
														<button
															onClick={() => handleDeleteCommand(command.id)}
															className="infio-commands-btn"
														>
															<Trash2 size={16} />
														</button>
													</div>
												</div>
												<div className="infio-commands-content">{command.contentText}</div>
											</div>
										)}
									</div>
								))
							)}
						</div>
					</>
				)}

				{activeTab === 'market' && (
					<>
						{/* search bar */}
						<div className="infio-commands-search">
							<Search size={18} className="infio-commands-search-icon" />
							<input
								type="text"
								placeholder="搜索市场命令..."
								value={searchTerm}
								onChange={handleSearch}
								className="infio-commands-search-input"
							/>
						</div>

						{/* market commands list */}
						<div className="infio-commands-list">
							{filteredMarketCommands.length === 0 ? (
								<div className="infio-commands-empty">
									<p>未找到匹配的市场命令</p>
								</div>
							) : (
								filteredMarketCommands.map(command => (
									<div key={command.id} className="infio-commands-market-item">
										<div className="infio-commands-market-header">
											<div className="infio-commands-market-info">
												<div className="infio-commands-market-name">
													{(() => {
														const IconComponent = getIconComponent(command.icon)
														return <IconComponent size={16} />
													})()}
													<span>{command.name}</span>
												</div>
												<div className="infio-commands-market-category">{command.category}</div>
											</div>
											<button
												onClick={() => handleInstallMarketCommand(command)}
												className="infio-commands-install-btn"
											>
												<Download size={16} />
											</button>
										</div>
										<div className="infio-commands-market-description">{command.description}</div>
										<div className="infio-commands-market-content">{command.contentText}</div>
									</div>
								))
							)}
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default CommandsView
