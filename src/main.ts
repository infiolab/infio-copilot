// @ts-nocheck
import { EditorView } from '@codemirror/view'
// import { PGlite } from '@electric-sql/pglite'
import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian'

import { ApplyView } from './ApplyView'
import { ChatView } from './ChatView'
import { ChatProps } from './components/chat-view/ChatView'
import { APPLY_VIEW_TYPE, CHAT_VIEW_TYPE, PREVIEW_VIEW_TYPE } from './constants'
import { getDiffStrategy } from "./core/diff/DiffStrategy"
import { InlineEdit } from './core/edit/inline-edit-processor'
import { McpHub } from './core/mcp/McpHub'
import { RAGEngine } from './core/rag/rag-engine'
import { MobileRAGEngine } from './core/rag/mobile-rag-engine'
import { DBManager } from './database/database-manager'
import { MobileDatabaseManager } from './database/mobile-database-manager'
import { migrateToJsonDatabase } from './database/json/migrateToJsonDatabase'
import { canUseFeature, getMobileFeatureMessage, isMobilePlatform } from './utils/platform-compatibility'
import EventListener from "./event-listener"
import { t } from './lang/helpers'
import { PreviewView } from './PreviewView'
import CompletionKeyWatcher from "./render-plugin/completion-key-watcher"
import DocumentChangesListener, {
	DocumentChanges,
	getPrefix, getSuffix,
	hasMultipleCursors,
	hasSelection
} from "./render-plugin/document-changes-listener"
import RenderSuggestionPlugin from "./render-plugin/render-surgestion-plugin"
import { InlineSuggestionState } from "./render-plugin/states"
import { InfioSettingTab } from './settings/SettingTab'
import StatusBar from "./status-bar"
import {
	InfioSettings,
	parseInfioSettings,
} from './types/settings'
import { getMentionableBlockData } from './utils/obsidian'
import './utils/path'
import { onEnt } from './utils/web-search'

export default class InfioPlugin extends Plugin {
	private metadataCacheUnloadFn: (() => void) | null = null
	private activeLeafChangeUnloadFn: (() => void) | null = null
	private dbManagerInitPromise: Promise<DBManager> | null = null
	private ragEngineInitPromise: Promise<RAGEngine> | null = null
	private mcpHubInitPromise: Promise<McpHub> | null = null
	settings: InfioSettings
	settingTab: InfioSettingTab
	settingsListeners: ((newSettings: InfioSettings) => void)[] = []
	initChatProps?: ChatProps
	dbManager: DBManager | MobileDatabaseManager | null = null
	mcpHub: McpHub | null = null
	ragEngine: RAGEngine | MobileRAGEngine | null = null
	inlineEdit: InlineEdit | null = null
	diffStrategy?: DiffStrategy

	async onload() {
		// load settings
		await this.loadSettings()

		// migrate to json database
		setTimeout(() => {
			void this.migrateToJsonStorage().then(() => { })
			void onEnt('loaded')
		}, 100)

		// add settings tab
		this.settingTab = new InfioSettingTab(this.app, this)
		this.addSettingTab(this.settingTab)

		// add icon to ribbon
		this.addRibbonIcon('wand-sparkles', t('main.openInfioCopilot'), () =>
			this.openChatView(),
		)

		// register views
		this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this))
		this.registerView(APPLY_VIEW_TYPE, (leaf) => new ApplyView(leaf))
		this.registerView(PREVIEW_VIEW_TYPE, (leaf) => new PreviewView(leaf))

		// register markdown processor for Inline Edit
		this.inlineEdit = new InlineEdit(this, this.settings);
		this.registerMarkdownCodeBlockProcessor("infioedit", (source, el, ctx) => {
			this.inlineEdit?.Processor(source, el, ctx);
		});

		// setup autocomplete event listener
		const statusBar = StatusBar.fromApp(this);
		const eventListener = EventListener.fromSettings(
			this.settings,
			statusBar,
			this.app
		);

		// initialize diff strategy
		this.diffStrategy = getDiffStrategy(
			this.settings.chatModelId || "",
			this.app,
			this.settings.fuzzyMatchThreshold,
			this.settings.experimentalDiffStrategy,
			this.settings.multiSearchReplaceDiffStrategy,
		)

		// add settings change listener
		this.addSettingsListener((newSettings) => {
			// Update inlineEdit when settings change
			this.inlineEdit = new InlineEdit(this, newSettings);
			// Update autocomplete event listener when settings change
			eventListener.handleSettingChanged(newSettings)
			// Update diff strategy when settings change
			this.diffStrategy = getDiffStrategy(
				this.settings.chatModelId || "",
				this.app,
				this.settings.fuzzyMatchThreshold,
				this.settings.experimentalDiffStrategy,
				this.settings.multiSearchReplaceDiffStrategy,
			)
			// Update MCP Hub when settings change
			if (this.settings.mcpEnabled && !this.mcpHub) {
				void this.getMcpHub()
			} else if (!this.settings.mcpEnabled && this.mcpHub) {
				this.mcpHub.dispose()
				this.mcpHub = null
				this.mcpHubInitPromise = null
			}
		});

		// setup autocomplete render plugin
		this.registerEditorExtension([
			InlineSuggestionState,
			CompletionKeyWatcher(
				eventListener.handleAcceptKeyPressed.bind(eventListener) as () => boolean,
				eventListener.handlePartialAcceptKeyPressed.bind(eventListener) as () => boolean,
				eventListener.handleCancelKeyPressed.bind(eventListener) as () => boolean,
			),
			DocumentChangesListener(
				eventListener.handleDocumentChange.bind(eventListener) as (documentChange: DocumentChanges) => Promise<void>
			),
			RenderSuggestionPlugin(),
		]);

		this.app.workspace.onLayoutReady(() => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);

			if (view) {
				// @ts-expect-error, not typed
				const editorView = view.editor.cm as EditorView;
				eventListener.onViewUpdate(editorView);
			}
		});

		/// *** Event Listeners ***
		this.registerEvent(
			this.app.workspace.on("active-leaf-change", (leaf) => {
				if (leaf?.view instanceof MarkdownView) {
					// @ts-expect-error, not typed
					const editorView = leaf.view.editor.cm as EditorView;
					eventListener.onViewUpdate(editorView);
					if (leaf.view.file) {
						eventListener.handleFileChange(leaf.view.file);
					}
				}
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("changed", (file: TFile) => {
				if (file) {
					eventListener.handleFileChange(file);
					// is not worth it to update the file index on every file change
					// this.ragEngine?.updateFileIndex(file);
				}
			})
		);

		this.registerEvent(
			this.app.metadataCache.on("deleted", (file: TFile) => {
				if (file) {
					this.ragEngine?.deleteFileIndex(file);
				}
			})
		);

		/// *** Commands ***
		this.addCommand({
			id: 'open-new-chat',
			name: t('main.openNewChat'),
			callback: () => this.openChatView(true),
		})

		this.addCommand({
			id: 'add-selection-to-chat',
			name: t('main.addSelectionToChat'),
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.addSelectionToChat(editor, view)
			},
			// hotkeys: [
			// 	{
			// 		modifiers: ['Mod', 'Shift'],
			// 		key: 'l',
			// 	},
			// ],
		})

		this.addCommand({
			id: 'rebuild-vault-index',
			name: t('main.rebuildVaultIndex'),
			callback: async () => {
				const notice = new Notice(t('notifications.rebuildingIndex'), 0)
				try {
					const ragEngine = await this.getRAGEngine()
					await ragEngine.updateVaultIndex(
						{ reindexAll: true },
						(queryProgress) => {
							if (queryProgress.type === 'indexing') {
								const { completedChunks, totalChunks } =
									queryProgress.indexProgress
								notice.setMessage(
									t('notifications.indexingChunks', { completedChunks, totalChunks }),
								)
							}
						},
					)
					notice.setMessage(t('notifications.rebuildComplete'))
				} catch (error) {
					console.error(error)
					notice.setMessage(t('notifications.rebuildFailed'))
				} finally {
					setTimeout(() => {
						notice.hide()
					}, 1000)
				}
			},
		})

		this.addCommand({
			id: 'update-vault-index',
			name: t('main.updateVaultIndex'),
			callback: async () => {
				const notice = new Notice(t('notifications.updatingIndex'), 0)
				try {
					const ragEngine = await this.getRAGEngine()
					await ragEngine.updateVaultIndex(
						{ reindexAll: false },
						(queryProgress) => {
							if (queryProgress.type === 'indexing') {
								const { completedChunks, totalChunks } =
									queryProgress.indexProgress
								notice.setMessage(
									t('notifications.indexingChunks', { completedChunks, totalChunks }),
								)
							}
						},
					)
					notice.setMessage(t('notifications.updateComplete'))
				} catch (error) {
					console.error(error)
					notice.setMessage(t('notifications.updateFailed'))
				} finally {
					setTimeout(() => {
						notice.hide()
					}, 1000)
				}
			},
		})

		this.addCommand({
			id: 'autocomplete-accept',
			name: t('main.autocompleteAccept'),
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				if (checking) {
					return (
						eventListener.isSuggesting()
					);
				}

				eventListener.handleAcceptCommand();

				return true;
			},
		})

		this.addCommand({
			id: 'autocomplete-predict',
			name: t('main.autocompletePredict'),
			editorCheckCallback: (
				checking: boolean,
				editor: Editor,
				view: MarkdownView
			) => {
				// @ts-expect-error, not typed
				const editorView = editor.cm as EditorView;
				const state = editorView.state;
				if (checking) {
					return eventListener.isIdle() && !hasMultipleCursors(state) && !hasSelection(state);
				}

				const prefix = getPrefix(state)
				const suffix = getSuffix(state)

				eventListener.handlePredictCommand(prefix, suffix);
				return true;
			},
		});

		this.addCommand({
			id: "autocomplete-toggle",
			name: t('main.autocompleteToggle'),
			callback: () => {
				const newValue = !this.settings.autocompleteEnabled;
				this.setSettings({
					...this.settings,
					autocompleteEnabled: newValue,
				})
			},
		});

		this.addCommand({
			id: "autocomplete-enable",
			name: t('main.autocompleteEnable'),
			checkCallback: (checking) => {
				if (checking) {
					return !this.settings.autocompleteEnabled;
				}

				this.setSettings({
					...this.settings,
					autocompleteEnabled: true,
				})
				return true;
			},
		});

		this.addCommand({
			id: "autocomplete-disable",
			name: t('main.autocompleteDisable'),
			checkCallback: (checking) => {
				if (checking) {
					return this.settings.autocompleteEnabled;
				}

				this.setSettings({
					...this.settings,
					autocompleteEnabled: false,
				})
				return true;
			},
		});

		this.addCommand({
			id: "ai-inline-edit",
			name: t('main.inlineEditCommand'),
			// hotkeys: [
			// 	{
			// 		modifiers: ['Mod', 'Shift'],
			// 		key: "k",
			// 	},
			// ],
			editorCallback: (editor: Editor) => {
				const selection = editor.getSelection();
				if (!selection) {
					new Notice(t('notifications.selectTextFirst'));
					return;
				}
				// Get the selection start position
				const from = editor.getCursor("from");
				// Create the position for inserting the block
				const insertPos = { line: from.line, ch: 0 };
				// Create the AI block with the selected text
				const customBlock = "```infioedit\n```\n";
				// Insert the block above the selection
				editor.replaceRange(customBlock, insertPos);
			},
		});
	}

	onunload() {
		// Promise cleanup
		this.dbManagerInitPromise = null
		this.ragEngineInitPromise = null
		this.mcpHubInitPromise = null
		// RagEngine cleanup
		this.ragEngine?.cleanup()
		this.ragEngine = null
		// Database cleanup
		this.dbManager?.cleanup()
		this.dbManager = null
		// MCP Hub cleanup
		this.mcpHub?.dispose()
		this.mcpHub = null
	}

	async loadSettings() {
		this.settings = parseInfioSettings(await this.loadData())
		await this.saveData(this.settings) // Save updated settings
	}

	async setSettings(newSettings: InfioSettings) {
		this.settings = newSettings
		await this.saveData(newSettings)
		this.ragEngine?.setSettings(newSettings)
		this.settingsListeners.forEach((listener) => listener(newSettings))
	}

	addSettingsListener(
		listener: (newSettings: InfioSettings) => void,
	) {
		this.settingsListeners.push(listener)
		return () => {
			this.settingsListeners = this.settingsListeners.filter(
				(l) => l !== listener,
			)
		}
	}

	async openChatView(openNewChat = false) {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView)
		const editor = view?.editor
		if (!view || !editor) {
			this.activateChatView(undefined, openNewChat)
			return
		}
		const selectedBlockData = await getMentionableBlockData(editor, view)
		this.activateChatView(
			{
				selectedBlock: selectedBlockData ?? undefined,
			},
			openNewChat,
		)
	}

	async activateChatView(chatProps?: ChatProps, openNewChat = false) {
		// chatProps is consumed in ChatView.tsx
		this.initChatProps = chatProps

		const leaf = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0]

		await (leaf ?? this.app.workspace.getRightLeaf(false))?.setViewState({
			type: CHAT_VIEW_TYPE,
			active: true,
		})

		if (openNewChat && leaf && leaf.view instanceof ChatView) {
			leaf.view.openNewChat(chatProps?.selectedBlock)
		}

		this.app.workspace.revealLeaf(
			this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0],
		)
	}

	async addSelectionToChat(editor: Editor, view: MarkdownView) {
		const data = await getMentionableBlockData(editor, view)
		if (!data) return

		const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
		if (leaves.length === 0 || !(leaves[0].view instanceof ChatView)) {
			await this.activateChatView({
				selectedBlock: data,
			})
			return
		}

		// bring leaf to foreground (uncollapse sidebar if it's collapsed)
		await this.app.workspace.revealLeaf(leaves[0])

		const chatView = leaves[0].view
		chatView.addSelectionToChat(data)
		chatView.focusMessage()
	}

	async getDbManager(): Promise<DBManager | MobileDatabaseManager> {
		if (this.dbManager) {
			return this.dbManager
		}

		if (!this.dbManagerInitPromise) {
			this.dbManagerInitPromise = (async () => {
				// 根据平台选择不同的数据库管理器
				if (isMobilePlatform()) {
					console.log('检测到移动端平台，使用简化数据库管理器')
					new Notice(getMobileFeatureMessage('database'), 5000)
					this.dbManager = await MobileDatabaseManager.create(this.app) as any
				} else {
					this.dbManager = await DBManager.create(this.app)
				}
				return this.dbManager
			})()
		}

		// if initialization is running, wait for it to complete instead of creating a new initialization promise
		return this.dbManagerInitPromise
	}

	async getMcpHub(): Promise<McpHub | null> {
		// MCP is not enabled
		if (!this.settings.mcpEnabled) {
			// new Notice('MCP is not enabled')
			return null
		}

		// 检查移动端兼容性
		if (isMobilePlatform()) {
			if (!canUseFeature('supportsMCP')) {
				new Notice(getMobileFeatureMessage('mcp'), 5000)
				return null
			}
		}

		// if we already have an instance, return it
		if (this.mcpHub) {
			return this.mcpHub
		}

		if (!this.mcpHubInitPromise) {
			this.mcpHubInitPromise = (async () => {
				this.mcpHub = new McpHub(this.app, this)
				await this.mcpHub.onload()
				return this.mcpHub
			})()
		}

		// if initialization is running, wait for it to complete instead of creating a new initialization promise
		return this.mcpHubInitPromise
	}

	async getRAGEngine(): Promise<RAGEngine | MobileRAGEngine> {
		if (this.ragEngine) {
			return this.ragEngine
		}

		if (!this.ragEngineInitPromise) {
			this.ragEngineInitPromise = (async () => {
				const dbManager = await this.getDbManager()
				
				// 根据平台选择不同的 RAG 引擎
				if (isMobilePlatform() && dbManager instanceof MobileDatabaseManager) {
					console.log('检测到移动端平台，使用简化 RAG 引擎')
					this.ragEngine = new MobileRAGEngine(this.app, this.settings, dbManager) as any
				} else {
					this.ragEngine = new RAGEngine(this.app, this.settings, dbManager as DBManager)
				}
				return this.ragEngine
			})()
		}

		// if initialization is running, wait for it to complete instead of creating a new initialization promise
		return this.ragEngineInitPromise
	}

	private async migrateToJsonStorage() {
		try {
			const dbManager = await this.getDbManager()
			await migrateToJsonDatabase(this.app, dbManager, async () => {
				await this.reloadChatView()
				console.log('Migration to JSON storage completed successfully')
			})
		} catch (error) {
			console.error('Failed to migrate to JSON storage:', error)
			new Notice(
				t('notifications.migrationFailed'),
			)
		}
	}

	private async reloadChatView() {
		const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
		if (leaves.length === 0 || !(leaves[0].view instanceof ChatView)) {
			return
		}
		new Notice(t('notifications.reloadingInfio'), 1000)
		leaves[0].detach()
		await this.activateChatView()
	}
}
