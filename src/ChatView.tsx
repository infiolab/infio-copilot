import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ItemView, WorkspaceLeaf } from 'obsidian'
import React from 'react'
import { Root, createRoot } from 'react-dom/client'

import Chat, { ChatProps, ChatRef } from './components/chat-view/ChatView'
import { CHAT_VIEW_TYPE } from './constants'
import { AppProvider } from './contexts/AppContext'
import { DarkModeProvider } from './contexts/DarkModeContext'
import { DatabaseProvider } from './contexts/DatabaseContext'
import { DialogProvider } from './contexts/DialogContext'
import { DiffStrategyProvider } from './contexts/DiffStrategyContext'
import { LLMProvider } from './contexts/LLMContext'
import { McpHubProvider } from './contexts/McpHubContext'
import { RAGProvider } from './contexts/RAGContext'
import { SettingsProvider } from './contexts/SettingsContext'
import InfioPlugin from './main'
import { MentionableBlockData } from './types/mentionable'
import { InfioSettings } from './types/settings'

export class ChatView extends ItemView {
	private root: Root | null = null
	private settings: InfioSettings
	private initialChatProps?: ChatProps
	private chatRef: React.RefObject<ChatRef> = React.createRef()

	constructor(
		leaf: WorkspaceLeaf,
		private plugin: InfioPlugin,
	) {
		super(leaf)
		this.settings = plugin.settings
		this.initialChatProps = plugin.initChatProps
	}

	getViewType() {
		return CHAT_VIEW_TYPE
	}

	getIcon() {
		return 'wand-sparkles'
	}

	getDisplayText() {
		return 'Infio chat'
	}

	async onOpen() {
		try {
			await this.render()
			
			// Consume chatProps
			this.initialChatProps = undefined
		} catch (error) {
			console.error('Failed to open ChatView:', error)
			// Create a fallback UI
			this.containerEl.createEl('div', {
				text: 'Failed to load chat view. Please check console for details.',
				cls: 'infio-error-message'
			})
		}
	}

	async onClose() {
		this.root?.unmount()
	}

	async render() {
		try {
			if (!this.root) {
				// Check if containerEl has the expected structure
				if (!this.containerEl.children[1]) {
					throw new Error('ChatView container structure is invalid')
				}
				this.root = createRoot(this.containerEl.children[1])
			}

			const queryClient = new QueryClient({
				defaultOptions: {
					queries: {
						gcTime: 0, // Immediately garbage collect queries. It prevents memory leak on ChatView close.
					},
					mutations: {
						gcTime: 0, // Immediately garbage collect mutations. It prevents memory leak on ChatView close.
					},
				},
			})

			this.root.render(
				<AppProvider app={this.app}>
					<SettingsProvider
						settings={this.settings}
						setSettings={(newSettings) => this.plugin.setSettings(newSettings)}
						addSettingsChangeListener={(listener) =>
							this.plugin.addSettingsListener(listener)
						}
					>
						<DarkModeProvider>
							<LLMProvider>
								<DatabaseProvider
									getDatabaseManager={() => this.plugin.getDbManager()}
								>
									<DiffStrategyProvider diffStrategy={this.plugin.diffStrategy}>
										<RAGProvider getRAGEngine={() => this.plugin.getRAGEngine()}>
											<McpHubProvider getMcpHub={() => this.plugin.getMcpHub()}>
												<QueryClientProvider client={queryClient}>
													<React.StrictMode>
														<DialogProvider
															container={this.containerEl.children[1] as HTMLElement}
														>
															<Chat ref={this.chatRef} {...this.initialChatProps} />
														</DialogProvider>
													</React.StrictMode>
												</QueryClientProvider>
											</McpHubProvider>
										</RAGProvider>
									</DiffStrategyProvider>
								</DatabaseProvider>
							</LLMProvider>
						</DarkModeProvider>
					</SettingsProvider>
				</AppProvider>,
			)
		} catch (error) {
			console.error('Failed to render ChatView:', error)
			// Clear container and show error message
			this.containerEl.empty()
			this.containerEl.createEl('div', {
				text: 'Failed to render chat view. Please restart Obsidian and check console for details.',
				cls: 'infio-error-message'
			})
			throw error
		}
	}

	openNewChat(selectedBlock?: MentionableBlockData) {
		this.chatRef.current?.openNewChat(selectedBlock)
	}

	addSelectionToChat(selectedBlock: MentionableBlockData) {
		this.chatRef.current?.addSelectionToChat(selectedBlock)
	}

	focusMessage() {
		this.chatRef.current?.focusMessage()
	}
}
