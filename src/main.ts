// @ts-expect-error - @codemirror/view is provided by Obsidian runtime
import { EditorView } from '@codemirror/view'

// import { PGlite } from '@electric-sql/pglite'
import { Editor, MarkdownView, Notice, Plugin, TFile } from 'obsidian'

import { ApplyView } from './ApplyView'
import { ChatView } from './ChatView'
import { ChatProps } from './components/chat-view/ChatView'
import { APPLY_VIEW_TYPE, CHAT_VIEW_TYPE, PREVIEW_VIEW_TYPE } from './constants'
import { DiffStrategy, getDiffStrategy } from "./core/diff/DiffStrategy"
import { InlineEdit } from './core/edit/inline-edit-processor'
import { McpHub } from './core/mcp/McpHub'
import { RAGEngine } from './core/rag/rag-engine'
import { DBManager } from './database/database-manager'
import { migrateToJsonDatabase } from './database/json/migrateToJsonDatabase'
import EventListener from "./event-listener"
import { t } from './lang/helpers'
import { PreviewView } from './PreviewView'
import CompletionKeyWatcher from "./render-plugin/completion-key-watcher"
import DocumentChangesListener, {
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
import { CrashReporter } from './utils/crash-reporter'
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
	dbManager: DBManager | null = null
	mcpHub: McpHub | null = null
	ragEngine: RAGEngine | null = null
	inlineEdit: InlineEdit | null = null
	diffStrategy?: DiffStrategy
	private crashReporter: CrashReporter

	async onload() {
		try {
			// Initialize crash reporter
			this.crashReporter = CrashReporter.getInstance()

			// load settings
			await this.loadSettings()

			// migrate to json database
			setTimeout(() => {
				void this.migrateToJsonStorage().then(() => { })
				void onEnt('loaded').catch((error) => {
					console.error('Failed to call onEnt:', error)
				})
			}, 100)

			// add settings tab
			this.settingTab = new InfioSettingTab(this.app, this)
			this.addSettingTab(this.settingTab)

			// add icon to ribbon
			const ribbonIconText = t('main.openInfioCopilot') as string
			this.addRibbonIcon('wand-sparkles', ribbonIconText, () =>
				this.openChatView(),
			)

			// register views
			this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this))
			this.registerView(APPLY_VIEW_TYPE, (leaf) => new ApplyView(leaf))
			this.registerView(PREVIEW_VIEW_TYPE, (leaf) => new PreviewView(leaf))

			// register markdown processor for Inline Edit
			this.inlineEdit = new InlineEdit(this, this.settings);
			this.registerMarkdownCodeBlockProcessor("infioedit", (source, el, ctx) => {
				try {
					this.inlineEdit?.Processor(source, el, ctx);
				} catch (error) {
					console.error('Failed to process infioedit block:', error)
					el.createEl('div', { text: 'Error processing infioedit block' })
				}
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
				try {
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
						void this.getMcpHub().catch((error) => {
							console.error('Failed to initialize MCP Hub:', error)
						})
					} else if (!this.settings.mcpEnabled && this.mcpHub) {
						this.mcpHub.dispose()
						this.mcpHub = null
						this.mcpHubInitPromise = null
					}
				} catch (error) {
					console.error('Failed to handle settings change:', error)
				}
			});

			// setup autocomplete render plugin
			this.registerEditorExtension([
				InlineSuggestionState,
				CompletionKeyWatcher(
					eventListener.handleAcceptKeyPressed.bind(eventListener),
					eventListener.handlePartialAcceptKeyPressed.bind(eventListener),
					eventListener.handleCancelKeyPressed.bind(eventListener),
				),
				DocumentChangesListener(
					eventListener.handleDocumentChange.bind(eventListener)
				),
				RenderSuggestionPlugin(),
			]);

			this.app.workspace.onLayoutReady(() => {
				try {
					const view = this.app.workspace.getActiveViewOfType(MarkdownView);

					if (view && view.editor && (view.editor as any).cm) {
						const editorView = (view.editor as any).cm as EditorView;
						eventListener.onViewUpdate(editorView);
					}
				} catch (error) {
					console.error('Failed to setup editor view on layout ready:', error)
				}
			});

			/// *** Event Listeners ***
			this.registerEvent(
				this.app.workspace.on("active-leaf-change", (leaf) => {
					try {
						if (leaf?.view instanceof MarkdownView && leaf.view.editor && (leaf.view.editor as any).cm) {
							const editorView = (leaf.view.editor as any).cm as EditorView;
							eventListener.onViewUpdate(editorView);
							if (leaf.view.file) {
								eventListener.handleFileChange(leaf.view.file);
							}
						}
					} catch (error) {
						console.error('Failed to handle active leaf change:', error)
					}
				})
			);

			this.registerEvent(
				this.app.metadataCache.on("changed", (file: TFile) => {
					try {
						if (file) {
							eventListener.handleFileChange(file);
							// is not worth it to update the file index on every file change
							// this.ragEngine?.updateFileIndex(file);
						}
					} catch (error) {
						console.error('Failed to handle file change:', error)
					}
				})
			);

			this.registerEvent(
				this.app.metadataCache.on("deleted", (file: TFile) => {
					try {
						if (file) {
							this.ragEngine?.deleteFileIndex(file);
						}
					} catch (error) {
						console.error('Failed to handle file deletion:', error)
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
					const notice = new Notice(t('notifications.rebuildingIndex') as string, 0)
					try {
						const ragEngine = await this.getRAGEngine()
						await ragEngine.updateVaultIndex(
							{ reindexAll: true },
							(queryProgress) => {
								if (queryProgress.type === 'indexing') {
									const { completedChunks, totalChunks } =
										queryProgress.indexProgress
									notice.setMessage(
										t('notifications.indexingChunks', { completedChunks, totalChunks }) as string,
									)
								}
							},
						)
						notice.setMessage(t('notifications.rebuildComplete') as string)
					} catch (error) {
						console.error(error)
						notice.setMessage(t('notifications.rebuildFailed') as string)
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
					const notice = new Notice(t('notifications.updatingIndex') as string, 0)
					try {
						const ragEngine = await this.getRAGEngine()
						await ragEngine.updateVaultIndex(
							{ reindexAll: false },
							(queryProgress) => {
								if (queryProgress.type === 'indexing') {
									const { completedChunks, totalChunks } =
										queryProgress.indexProgress
									notice.setMessage(
										t('notifications.indexingChunks', { completedChunks, totalChunks }) as string,
									)
								}
							},
						)
						notice.setMessage(t('notifications.updateComplete') as string)
					} catch (error) {
						console.error(error)
						notice.setMessage(t('notifications.updateFailed') as string)
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
					_editor: Editor,
					_view: MarkdownView
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
					_view: MarkdownView
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
						new Notice(t('notifications.selectTextFirst') as string);
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

			// 添加崩溃报告查看命令
			this.addCommand({
				id: 'show-crash-reports',
				name: '显示崩溃报告',
				callback: () => {
					const reports = this.crashReporter.getRecentReports()
					if (reports.length === 0) {
						new Notice('没有发现崩溃报告')
						return
					}

					const reportText = this.crashReporter.exportReports()
					console.log(reportText)

					// 创建一个模态窗口显示报告
					new Notice(`发现 ${reports.length} 个崩溃报告，已输出到控制台`, 5000)
				},
			});

			// 添加清理崩溃报告命令
			this.addCommand({
				id: 'clear-crash-reports',
				name: '清理崩溃报告',
				callback: () => {
					this.crashReporter.clearReports()
					new Notice('崩溃报告已清理')
				},
			});
		} catch (error) {
			console.error('Failed to load Infio plugin:', error)
			this.crashReporter?.reportCrash(error as Error, 'Plugin onload')
			this.crashReporter?.showUserFriendlyError('插件加载失败')
		}
	}

	onunload() {
		try {
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
		} catch (error) {
			console.error('Error during plugin unload:', error)
		}
	}

	/**
	 * 记录插件错误并显示用户友好的通知
	 */
	private logError(message: string, error: any, showNotice = true) {
		this.crashReporter?.reportCrash(error, message)

		if (showNotice) {
			this.crashReporter?.showUserFriendlyError(message)
		}
	}

	async loadSettings() {
		try {
			this.settings = parseInfioSettings(await this.loadData())
			await this.saveData(this.settings) // Save updated settings
		} catch (error) {
			console.error('Failed to load settings:', error)
			// Fall back to default settings
			this.settings = parseInfioSettings({})
		}
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

	async getDbManager(): Promise<DBManager> {
		if (this.dbManager) {
			return this.dbManager
		}

		if (!this.dbManagerInitPromise) {
			this.dbManagerInitPromise = (async () => {
				this.dbManager = await DBManager.create(this.app)
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

	async getRAGEngine(): Promise<RAGEngine> {
		if (this.ragEngine) {
			return this.ragEngine
		}

		if (!this.ragEngineInitPromise) {
			this.ragEngineInitPromise = (async () => {
				const dbManager = await this.getDbManager()
				this.ragEngine = new RAGEngine(this.app, this.settings, dbManager)
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
				t('notifications.migrationFailed') as string,
			)
		}
	}

	private async reloadChatView() {
		const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
		if (leaves.length === 0 || !(leaves[0].view instanceof ChatView)) {
			return
		}
		new Notice(t('notifications.reloadingInfio') as string, 1000)
		leaves[0].detach()
		await this.activateChatView()
	}
}
