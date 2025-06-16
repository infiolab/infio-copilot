import {
	App,
	Modal,
	Notice,
	PluginSettingTab,
	Setting,
	TFile
} from 'obsidian';
import * as React from "react";
import { createRoot } from "react-dom/client";

import { t } from '../lang/helpers';
import InfioPlugin from '../main';
import { InfioSettings } from '../types/settings';
import { findFilesMatchingPatterns } from '../utils/glob-utils';

// import AdvancedSettings from './components/AdvancedSettings';
import BasicAutoCompleteSettings from './components/BasicAutoCompleteSettings';
// import DangerZoneSettings from './components/DangerZoneSettings';
import CustomProviderSettings from './components/ModelProviderSettings';
import PostprocessingSettings from './components/PostprocessingSettings';
import PreprocessingSettings from './components/PreprocessingSettings';
import PrivacySettings from './components/PrivacySettings';
import TriggerSettingsSection from './components/TriggerSettingsSection';

export class InfioSettingTab extends PluginSettingTab {
	plugin: InfioPlugin;
	private autoCompleteContainer: HTMLElement | null = null;
	private modelsContainer: HTMLElement | null = null;

	constructor(app: App, plugin: InfioPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()
		this.renderModelsSection(containerEl)
		this.renderModelParametersSection(containerEl)
		this.renderFilesSearchSection(containerEl)
		this.renderChatBehaviorSection(containerEl)
		this.renderDeepResearchSection(containerEl)
		this.renderRAGSection(containerEl)
		this.renderAutoCompleteSection(containerEl)
	}

	private renderModelsContent(containerEl: HTMLElement): void {
		const div = containerEl.createDiv("div");
		const sections = createRoot(div);
		sections.render(
			<CustomProviderSettings
				plugin={this.plugin}
				onSettingsUpdate={() => {
					if (this.modelsContainer) {
						this.modelsContainer.empty();
						this.renderModelsContent(this.modelsContainer);
					}
				}}
			/>
		);
	}

	private renderModelParametersSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setHeading().setName(t('settings.ModelParameters.title'));
		new Setting(containerEl)
			.setName(t('settings.ModelParameters.temperature'))
			.setDesc(t('settings.ModelParameters.temperatureDescription'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.modelOptions.temperature))
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							modelOptions: {
								...this.plugin.settings.modelOptions,
								temperature: parseFloat(value),
							},
						});
					})
			});
		new Setting(containerEl)
			.setName(t('settings.ModelParameters.topP'))
			.setDesc(t('settings.ModelParameters.topPDescription'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.modelOptions.top_p))
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							modelOptions: {
								...this.plugin.settings.modelOptions,
								top_p: parseFloat(value),
							},
						});
					})
			});
		new Setting(containerEl)
			.setName(t('settings.ModelParameters.frequencyPenalty'))
			.setDesc(t('settings.ModelParameters.frequencyPenaltyDescription'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.modelOptions.frequency_penalty))
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							modelOptions: {
								...this.plugin.settings.modelOptions,
								frequency_penalty: parseFloat(value),
							},
						});
					})
			});
		new Setting(containerEl)
			.setName(t('settings.ModelParameters.presencePenalty'))
			.setDesc(t('settings.ModelParameters.presencePenaltyDescription'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.modelOptions.presence_penalty))
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							modelOptions: {
								...this.plugin.settings.modelOptions,
								presence_penalty: parseFloat(value),
							},
						});
					})
			});
		new Setting(containerEl)
			.setName(t('settings.ModelParameters.maxTokens'))
			.setDesc(t('settings.ModelParameters.maxTokensDescription'))
			.addText((text) => {
				text
					.setValue(String(this.plugin.settings.modelOptions.max_tokens))
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							modelOptions: {
								...this.plugin.settings.modelOptions,
								max_tokens: parseInt(value),
							},
						});
					})
			});
	}

	private renderFilesSearchSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setHeading().setName(t('settings.FilesSearch.title'))
		new Setting(containerEl)
			.setName(t('settings.FilesSearch.method'))
			.setDesc(t('settings.FilesSearch.methodDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('auto', t('settings.FilesSearch.auto'))
					.addOption('semantic', t('settings.FilesSearch.semantic'))
					.addOption('regex', t('settings.FilesSearch.regex'))
					.addOption('match', t('settings.FilesSearch.match'))
					.setValue(this.plugin.settings.filesSearchSettings.method)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							filesSearchSettings: {
								...this.plugin.settings.filesSearchSettings,
								method: value as 'match' | 'regex' | 'semantic' | 'auto',
							}
						})
					}),
			)
		new Setting(containerEl)
			.setName(t('settings.FilesSearch.regexBackend'))
			.setDesc(t('settings.FilesSearch.regexBackendDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('ripgrep', t('settings.FilesSearch.ripgrep'))
					.addOption('coreplugin', t('settings.FilesSearch.coreplugin'))
					.setValue(this.plugin.settings.filesSearchSettings.regexBackend)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							filesSearchSettings: {
								...this.plugin.settings.filesSearchSettings,
								regexBackend: value as 'ripgrep' | 'coreplugin',
							}
						})
					}),
			)
		new Setting(containerEl)
			.setName(t('settings.FilesSearch.matchBackend'))
			.setDesc(t('settings.FilesSearch.matchBackendDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('coreplugin', t('settings.FilesSearch.coreplugin'))
					.addOption('omnisearch', t('settings.FilesSearch.omnisearch'))
					.setValue(this.plugin.settings.filesSearchSettings.matchBackend)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							filesSearchSettings: {
								...this.plugin.settings.filesSearchSettings,
								matchBackend: value as 'coreplugin' | 'omnisearch',
							}
						})
					}),
			)
		new Setting(containerEl)
			.setName(t('settings.FilesSearch.ripgrepPath'))
			.setDesc(t('settings.FilesSearch.ripgrepPathDescription'))
			.addText((text) =>
				text
					.setPlaceholder('/opt/homebrew/bin/')
					.setValue(this.plugin.settings.filesSearchSettings.ripgrepPath)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							filesSearchSettings: {
								...this.plugin.settings.filesSearchSettings,
								ripgrepPath: value,
							}
						})
					}),
			)
	}

	private renderChatBehaviorSection(containerEl: HTMLElement): void {
		new Setting(containerEl).setHeading().setName(t('settings.ChatBehavior.title'));
		new Setting(containerEl)
			.setName(t('settings.ChatBehavior.defaultMention'))
			.setDesc(t('settings.ChatBehavior.defaultMentionDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('none', t('settings.ChatBehavior.none'))
					.addOption('current-file', t('settings.ChatBehavior.currentFile'))
					.addOption('vault', t('settings.ChatBehavior.vault'))
					.setValue(this.plugin.settings.defaultMention || 'none')
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							defaultMention: value as 'none' | 'current-file' | 'vault',
						});
					}),
			);
	}

	renderModelsSection(containerEl: HTMLElement): void {
		const modelsDiv = containerEl.createDiv("models-section");
		this.modelsContainer = modelsDiv;
		this.renderModelsContent(modelsDiv);
	}

	renderDeepResearchSection(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setHeading()
			.setName(t('settings.WebSearch.title'))

    new Setting(containerEl)
			.setName(t('settings.WebSearch.webSearchBackend'))
			.setDesc(t('settings.WebSearch.webSearchBackendDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('serpapi', t('settings.WebSearch.serpapi'))
					.addOption('scrapingdog', t('settings.WebSearch.scrapingdog'))
          .addOption('serper', t('settings.WebSearch.serper'))
          .addOption('jina', t('settings.WebSearch.jina'))
          .addOption('duckduckgo', t('settings.WebSearch.duckduckgo'))
          .addOption('brave', t('settings.WebSearch.brave'))
					.setValue(this.plugin.settings.webSearchSettings.webSearchBackend)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								// @ts-ignore
								webSearchBackend: value,
							},
						})
					}),
			)

    new Setting(containerEl)
			.setName(t('settings.WebSearch.urlFetchBackend'))
			.setDesc(t('settings.WebSearch.urlFetchBackendDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('jina', t('settings.WebSearch.jina'))
					.addOption('local', t('settings.WebSearch.local'))
					.setValue(this.plugin.settings.webSearchSettings.urlFetchBackend)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								// @ts-ignore
								urlFetchBackend: value,
							},
						})
					}),
			)

    // SerpAPI
		new Setting(containerEl)
			.setName(t('settings.WebSearch.serpapiApiKey'))
			.setDesc(createFragment(el => {
				el.appendText(t('settings.WebSearch.serpapiApiKeyDescription') + ' ');
				const a = el.createEl('a', {
					href: 'https://serpapi.com/manage-api-key',
					text: 'https://serpapi.com/manage-api-key'
				});
				a.setAttr('target', '_blank');
				a.setAttr('rel', 'noopener');
			}))
			.setClass('setting-item-heading-smaller')
			.addText((text) => {
				const t = text
					.setValue(this.plugin.settings.webSearchSettings.serpapiApiKey)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								serpapiApiKey: value,
							},
						})
					});
				if (t.inputEl) {
					t.inputEl.type = "password";
				}
				return t;
			})

		new Setting(containerEl)
			.setName(t('settings.WebSearch.serpapiSearchEngine'))
			.setDesc(t('settings.WebSearch.serpapiSearchEngineDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('google', t('settings.WebSearch.google'))
					.addOption('duckduckgo', t('settings.WebSearch.duckduckgo'))
					.addOption('bing', t('settings.WebSearch.bing'))
					.setValue(this.plugin.settings.webSearchSettings.serpapiSearchEngine)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								// @ts-ignore
								serpapiSearchEngine: value,
							},
						})
					}),
			)

    // Scrapingdog
		new Setting(containerEl)
			.setName(t('settings.WebSearch.scrapingdogApiKey'))
			.setDesc(createFragment(el => {
				el.appendText(t('settings.WebSearch.scrapingdogApiKeyDescription') + ' ');
				const a = el.createEl('a', {
					href: 'https://www.scrapingdog.com/',
					text: 'https://www.scrapingdog.com/'
				});
				a.setAttr('target', '_blank');
				a.setAttr('rel', 'noopener');
			}))
			.setClass('setting-item-heading-smaller')
			.addText((text) => {
				const t = text
					.setValue(this.plugin.settings.webSearchSettings.scrapingdogApiKey)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								scrapingdogApiKey: value,
							},
						})
					});
				if (t.inputEl) {
					t.inputEl.type = "password";
				}
				return t;
			})

		new Setting(containerEl)
			.setName(t('settings.WebSearch.scrapingdogSearchEngine'))
			.setDesc(t('settings.WebSearch.scrapingdogSearchEngineDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('google', t('settings.WebSearch.google'))
					.addOption('bing', t('settings.WebSearch.bing'))
					.setValue(this.plugin.settings.webSearchSettings.scrapingdogSearchEngine)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								// @ts-ignore
								scrapingdogSearchEngine: value,
							},
						})
					}),
			)

    // Serper
		new Setting(containerEl)
			.setName(t('settings.WebSearch.scrperApiKey'))
			.setDesc(createFragment(el => {
				el.appendText(t('settings.WebSearch.scrperApiKeyDescription') + ' ');
				const a = el.createEl('a', {
					href: 'https://serper.dev/',
					text: 'https://serper.dev/'
				});
				a.setAttr('target', '_blank');
				a.setAttr('rel', 'noopener');
			}))
			.setClass('setting-item-heading-smaller')
			.addText((text) => {
				const t = text
					.setValue(this.plugin.settings.webSearchSettings.serperApiKey)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								serperApiKey: value,
							},
						})
					});
				if (t.inputEl) {
					t.inputEl.type = "password";
				}
				return t;
			})

    // Jina
		new Setting(containerEl)
			.setName(t('settings.WebSearch.jinaApiKey'))
			.setDesc(createFragment(el => {
				el.appendText(t('settings.WebSearch.jinaApiKeyDescription') + ' ');
				const a = el.createEl('a', {
					href: 'https://jina.ai/api-key',
					text: 'https://jina.ai/api-key'
				});
				a.setAttr('target', '_blank');
				a.setAttr('rel', 'noopener');
			}))
			.setClass('setting-item-heading-smaller')
			.addText((text) => {
				const t = text
					.setValue(this.plugin.settings.webSearchSettings.jinaApiKey)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							webSearchSettings: {
								...this.plugin.settings.webSearchSettings,
								jinaApiKey: value,
							},
						})
					});
				if (t.inputEl) {
					t.inputEl.type = "password";
				}
				return t;
			})

    // Serper
		new Setting(containerEl)
      .setName(t('settings.WebSearch.braveApiKey'))
      .setDesc(createFragment(el => {
        el.appendText(t('settings.WebSearch.braveApiKeyDescription') + ' ');
        const a = el.createEl('a', {
          href: 'https://brave.com/search/api/',
          text: 'https://brave.com/search/api/'
        });
        a.setAttr('target', '_blank');
        a.setAttr('rel', 'noopener');
      }))
      .setClass('setting-item-heading-smaller')
      .addText((text) => {
        const t = text
          .setValue(this.plugin.settings.webSearchSettings.braveApiKey)
          .onChange(async (value) => {
            await this.plugin.setSettings({
              ...this.plugin.settings,
              webSearchSettings: {
                ...this.plugin.settings.webSearchSettings,
                braveApiKey: value,
              },
            })
          });
        if (t.inputEl) {
          t.inputEl.type = "password";
        }
        return t;
      })
	}

	renderRAGSection(containerEl: HTMLElement): void {
		// 创建一个折叠区域的容器
		const ragContainer = containerEl.createDiv("rag-settings-container");
		
		// 创建标题元素，添加折叠控件
		const headerEl = ragContainer.createEl("div", { cls: "infio-collapsible-heading" });
		
		// 添加展开/折叠指示器
		const toggleIcon = headerEl.createEl("span", { cls: "infio-toggle-icon" });
		toggleIcon.textContent = "▶"; // 默认为折叠状态，使用右箭头
		
		// 添加标题文本
		const titleEl = headerEl.createEl("h3", { text: t('settings.RAG.title') });
		
		// 创建内容容器
		const contentContainer = ragContainer.createEl("div", { cls: "infio-collapsible-content" });
		
		// 默认设置为隐藏状态
		contentContainer.style.display = "none";
		
		// 添加点击事件处理
		headerEl.addEventListener("click", () => {
			if (contentContainer.style.display === "none") {
				contentContainer.style.display = "block";
				toggleIcon.textContent = "▼"; // 展开状态使用下箭头
				toggleIcon.style.transform = "rotate(0deg)";
			} else {
				contentContainer.style.display = "none";
				toggleIcon.textContent = "▶"; // 折叠状态使用右箭头
				toggleIcon.style.transform = "rotate(0deg)";
			}
		});
		
		// 添加样式
		headerEl.style.cursor = "pointer";
		headerEl.style.display = "flex";
		headerEl.style.alignItems = "center";
		headerEl.style.marginBottom = "10px";
		headerEl.style.padding = "6px 0";
		
		toggleIcon.style.marginRight = "5px";
		toggleIcon.style.fontSize = "10px";
		toggleIcon.style.transition = "transform 0.15s ease";
		
		titleEl.style.margin = "0";
		titleEl.style.fontSize = "16px";
		titleEl.style.fontWeight = "600";
		
		// 以下是原有的设置内容，移动到内容容器中
		new Setting(contentContainer)
			.setName(t('settings.RAG.filesystem'))
			.setDesc(t('settings.RAG.filesystemDescription'))
			.addDropdown((dropdown) =>
				dropdown
					.addOption('idb', t('settings.RAG.idb'))
					.addOption('opfs', t('settings.RAG.opfs'))
					.setValue(this.plugin.settings.ragOptions.filesystem)
					.onChange(async (value) => {
						await this.plugin.setSettings({
							...this.plugin.settings,
							ragOptions: {
								...this.plugin.settings.ragOptions,
								filesystem: value as 'idb' | 'opfs',
							},
						});
					}),
			);

		new Setting(contentContainer)
			.setName(t('settings.RAG.includePatterns'))
			.setDesc(
				t('settings.RAG.includePatternsDescription'),
			)
			.addButton((button) =>
				button.setButtonText(t('settings.RAG.testPatterns')).onClick(async () => {
					const patterns = this.plugin.settings.ragOptions.includePatterns
					const includedFiles = await findFilesMatchingPatterns(
						patterns,
						this.plugin.app.vault,
					)
					new IncludedFilesModal(this.app, includedFiles, patterns).open()
				}),
			)
		new Setting(contentContainer)
			.setClass('infio-chat-settings-textarea')
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.ragOptions.includePatterns.join('\n'))
					.onChange(async (value) => {
						const patterns = value
							.split('\n')
							.map((p) => p.trim())
							.filter((p) => p.length > 0)
						await this.plugin.setSettings({
							...this.plugin.settings,
							ragOptions: {
								...this.plugin.settings.ragOptions,
								includePatterns: patterns,
							},
						})
					}),
			)

		new Setting(contentContainer)
			.setName(t('settings.RAG.excludePatterns'))
			.setDesc(
				t('settings.RAG.excludePatternsDescription'),
			)
			.addButton((button) =>
				button.setButtonText(t('settings.RAG.testPatterns')).onClick(async () => {
					const patterns = this.plugin.settings.ragOptions.excludePatterns
					const excludedFiles = await findFilesMatchingPatterns(
						patterns,
						this.plugin.app.vault,
					)
					new ExcludedFilesModal(this.app, excludedFiles).open()
				}),
			)
		new Setting(contentContainer)
			.setClass('infio-chat-settings-textarea')
			.addTextArea((text) =>
				text
					.setValue(this.plugin.settings.ragOptions.excludePatterns.join('\n'))
					.onChange(async (value) => {
						const patterns = value
							.split('\n')
							.map((p) => p.trim())
							.filter((p) => p.length > 0)
						await this.plugin.setSettings({
							...this.plugin.settings,
							ragOptions: {
								...this.plugin.settings.ragOptions,
								excludePatterns: patterns,
							},
						})
					}),
			)

		new Setting(contentContainer)
			.setName(t('settings.RAG.chunkSize'))
			.setDesc(
				t('settings.RAG.chunkSizeDescription'),
			)
			.addText((text) =>
				text
					.setPlaceholder('1000')
					.setValue(String(this.plugin.settings.ragOptions.chunkSize))
					.onChange(async (value) => {
						const chunkSize = parseInt(value, 10)
						if (!isNaN(chunkSize)) {
							await this.plugin.setSettings({
								...this.plugin.settings,
								ragOptions: {
									...this.plugin.settings.ragOptions,
									chunkSize,
								},
							})
						}
					}),
			)

		new Setting(contentContainer)
			.setName(t('settings.RAG.batchSize'))
			.setDesc(
				t('settings.RAG.batchSizeDescription'),
			)
			.addText((text) =>
				text
					.setPlaceholder('32')
					.setValue(String(this.plugin.settings.ragOptions.batchSize))
					.onChange(async (value) => {
						const batchSize = parseInt(value, 10)
						if (!isNaN(batchSize)) {
							await this.plugin.setSettings({
								...this.plugin.settings,
								ragOptions: {
									...this.plugin.settings.ragOptions,
									batchSize,
								},
							})
						}
					}),
			)

		new Setting(contentContainer)
			.setName(t('settings.RAG.thresholdTokens'))
			.setDesc(
				t('settings.RAG.thresholdTokensDescription'),
			)
			.addText((text) =>
				text
					.setPlaceholder('8192')
					.setValue(String(this.plugin.settings.ragOptions.thresholdTokens))
					.onChange(async (value) => {
						const thresholdTokens = parseInt(value, 10)
						if (!isNaN(thresholdTokens)) {
							await this.plugin.setSettings({
								...this.plugin.settings,
								ragOptions: {
									...this.plugin.settings.ragOptions,
									thresholdTokens,
								},
							})
						}
					}),
			)

		new Setting(contentContainer)
			.setName(t('settings.RAG.minSimilarity'))
			.setDesc(
				t('settings.RAG.minSimilarityDescription'),
			)
			.addText((text) =>
				text
					.setPlaceholder('0.0')
					.setValue(String(this.plugin.settings.ragOptions.minSimilarity))
					.onChange(async (value) => {
						const minSimilarity = parseFloat(value)
						if (!isNaN(minSimilarity)) {
							await this.plugin.setSettings({
								...this.plugin.settings,
								ragOptions: {
									...this.plugin.settings.ragOptions,
									minSimilarity,
								},
							})
						}
					}),
			)

		new Setting(contentContainer)
			.setName(t('settings.RAG.limit'))
			.setDesc(
				t('settings.RAG.limitDescription'),
			)
			.addText((text) =>
				text
					.setPlaceholder('10')
					.setValue(String(this.plugin.settings.ragOptions.limit))
					.onChange(async (value) => {
						const limit = parseInt(value, 10)
						if (!isNaN(limit)) {
							await this.plugin.setSettings({
								...this.plugin.settings,
								ragOptions: {
									...this.plugin.settings.ragOptions,
									limit,
								},
							})
						}
					}),
			)
	}

	renderAutoCompleteSection(containerEl: HTMLElement): void {
		// 创建一个折叠区域的容器
		const autoCompleteContainer = containerEl.createDiv("auto-complete-settings-container");
		
		// 创建标题元素，添加折叠控件
		const headerEl = autoCompleteContainer.createEl("div", { cls: "infio-collapsible-heading" });
		
		// 添加展开/折叠指示器
		const toggleIcon = headerEl.createEl("span", { cls: "infio-toggle-icon" });
		toggleIcon.textContent = "▶"; // 默认为折叠状态，使用右箭头
		
		// 添加标题文本
		const titleEl = headerEl.createEl("h3", { text: t('settings.AutoComplete.title') });
		
		// 创建内容容器
		const contentContainer = autoCompleteContainer.createEl("div", { cls: "infio-collapsible-content" });
		
		// 保存容器引用
		this.autoCompleteContainer = contentContainer;
		
		// 默认设置为隐藏状态
		contentContainer.style.display = "none";
		
		// 添加点击事件处理
		headerEl.addEventListener("click", () => {
			if (contentContainer.style.display === "none") {
				contentContainer.style.display = "block";
				toggleIcon.textContent = "▼"; // 展开状态使用下箭头
				toggleIcon.style.transform = "rotate(0deg)";
			} else {
				contentContainer.style.display = "none";
				toggleIcon.textContent = "▶"; // 折叠状态使用右箭头
				toggleIcon.style.transform = "rotate(0deg)";
			}
		});
		
		// 添加样式
		headerEl.style.cursor = "pointer";
		headerEl.style.display = "flex";
		headerEl.style.alignItems = "center";
		headerEl.style.marginBottom = "10px";
		headerEl.style.padding = "6px 0";
		
		toggleIcon.style.marginRight = "5px";
		toggleIcon.style.fontSize = "10px";
		toggleIcon.style.transition = "transform 0.15s ease";
		
		titleEl.style.margin = "0";
		titleEl.style.fontSize = "16px";
		titleEl.style.fontWeight = "600";
		
		// 在内容容器中渲染AutoComplete设置
		this.renderAutoCompleteContent(contentContainer);
	}

	private renderAutoCompleteContent(containerEl: HTMLElement): void {
		const updateSettings = async (update: Partial<InfioSettings>) => {
			await this.plugin.setSettings({
				...this.plugin.settings,
				...update
			});

			// 只重新渲染 AutoComplete 部分
			if (this.autoCompleteContainer) {
				this.autoCompleteContainer.empty();
				this.renderAutoCompleteContent(this.autoCompleteContainer);
			}
		};

		const errors = new Map();

		// AutoComplete base
		// new Setting(containerEl).setName(t('settings.AutoComplete.title')).setHeading();
		this.renderComponent(containerEl,
			<BasicAutoCompleteSettings
				settings={this.plugin.settings}
				updateSettings={updateSettings}
			/>
		);

		// Preprocessing
		new Setting(containerEl).setName(t('settings.AutoComplete.preprocessing.title')).setHeading();
		this.renderComponent(containerEl,
			<PreprocessingSettings
				settings={this.plugin.settings}
				updateSettings={updateSettings}
				errors={errors}
			/>
		);

		// Postprocessing
		new Setting(containerEl).setName(t('settings.AutoComplete.postprocessing.title')).setHeading();
		this.renderComponent(containerEl,
			<PostprocessingSettings
				settings={this.plugin.settings}
				updateSettings={updateSettings}
			/>
		);

		// Trigger
		new Setting(containerEl).setName(t('settings.AutoComplete.trigger.title')).setHeading();
		this.renderComponent(containerEl,
			<TriggerSettingsSection
				settings={this.plugin.settings}
				updateSettings={updateSettings}
				errors={errors}
			/>
		);

		// Privacy
		new Setting(containerEl).setName(t('settings.AutoComplete.privacy.title')).setHeading();
		this.renderComponent(containerEl,
			<PrivacySettings
				settings={this.plugin.settings}
				updateSettings={updateSettings}
				errors={errors}
			/>
		);

		// // Danger zone
		// new Setting(containerEl).setName(t('settings.AutoComplete.dangerZone.title')).setHeading();
		// this.renderComponent(containerEl,
		// 	<DangerZoneSettings
		// 		settings={this.plugin.settings}
		// 		updateSettings={updateSettings}
		// 		onReset={() => {
		// 			new Notice(t('settings.AutoComplete.dangerZone.resetComplete'));
		// 		}}
		// 	/>
		// );

		// // Advanced
		
		// if (this.plugin.settings.advancedMode) {
		// 	new Setting(containerEl).setName(t('settings.AutoComplete.advanced.title')).setHeading();
		// 	this.renderComponent(containerEl,
		// 		<AdvancedSettings
		// 			settings={this.plugin.settings}
		// 			updateSettings={updateSettings}
		// 			errors={errors}
		// 		/>
		// 	);
		// }
	}

	private renderComponent(containerEl: HTMLElement, component: React.ReactNode) {
		const div = containerEl.createDiv("div");
		const root = createRoot(div);
		root.render(component);
	}
}

class ExcludedFilesModal extends Modal {
	private files: TFile[]

	constructor(app: App, files: TFile[]) {
		super(app)
		this.files = files
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()

		this.titleEl.setText(`Excluded Files (${this.files.length})`)

		if (this.files.length === 0) {
			contentEl.createEl('p', { text: t('settings.RAG.noExcludedFiles') })
			return
		}

		const list = contentEl.createEl('ul')
		this.files.forEach((file) => {
			list.createEl('li', { text: file.path })
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}

class IncludedFilesModal extends Modal {
	private files: TFile[]
	private patterns: string[]

	constructor(app: App, files: TFile[], patterns: string[]) {
		super(app)
		this.files = files
		this.patterns = patterns
	}

	onOpen() {
		const { contentEl } = this
		contentEl.empty()

		this.titleEl.setText(`Included Files (${this.files.length})`)

		if (this.patterns.length === 0) {
			contentEl.createEl('p', {
				text: t('settings.RAG.noInclusionPatterns'),
			})
			return
		}

		if (this.files.length === 0) {
			contentEl.createEl('p', {
				text: t('settings.RAG.noMatchingFiles'),
			})
			return
		}

		const list = contentEl.createEl('ul')
		this.files.forEach((file) => {
			list.createEl('li', { text: file.path })
		})
	}

	onClose() {
		const { contentEl } = this
		contentEl.empty()
	}
}
