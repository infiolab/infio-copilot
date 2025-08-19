import * as Switch from "@radix-ui/react-switch";
import { Download, Plus, Trash2, Undo2 } from 'lucide-react';
import { Notice, getLanguage } from 'obsidian';
import React, { useEffect, useMemo, useState } from 'react';

import { PREVIEW_VIEW_TYPE } from '../../constants';
import { useApp } from '../../contexts/AppContext';
import { useDiffStrategy } from '../../contexts/DiffStrategyContext';
import { useRAG } from '../../contexts/RAGContext';
import { useSettings } from '../../contexts/SettingsContext';
import { CustomMode } from '../../database/json/custom-mode/types';
import { useCustomModes } from '../../hooks/use-custom-mode';
import { IconSelector, getIconComponent } from '../../hooks/use-icon-selector';
import { fetchPromptsList } from '../../hooks/use-infio';
import { t } from '../../lang/helpers';
import { PreviewView, PreviewViewState } from '../../PreviewView';
import { defaultModes as buildinModes, getAllAvailableTools } from '../../utils/modes';
import { openOrCreateMarkdownFile } from '../../utils/obsidian';
import { PromptGenerator, getFullLanguageName } from '../../utils/prompt-generator';

// Market mode interface
interface MarketMode {
	slug: string
	name: string
	description: string
	roleDefinition: string
	customInstructions?: string
	tools: string[] // Changed from groups to tools
	strategy?: "ask" | "write" | "research" | "raw"
	enabled?: boolean
	category: string[] // Changed from string to string[]
	icon?: string
	downloads?: number
}

// API response interface for prompts
interface ApiPromptItem {
	id?: string
	slug?: string // Added slug field
	name?: string
	description?: string
	category?: string[] // Changed from string to string[]
	roleDefinition?: string
	customInstructions?: string
	tools?: string[]
	strategy?: "ask" | "write" | "research" | "raw"
	icon?: string
	downloads?: number
}

interface ApiPromptResponse {
	data?: ApiPromptItem[]
}

const CustomModeView = () => {
	const app = useApp()

	const {
		createCustomMode,
		deleteCustomMode,
		updateCustomMode,
		toggleCustomModeEnabled,
		customModeList,
		customModePrompts,
		// New builtin mode management
		builtinModeOverrides,
		createOrUpdateBuiltinModeOverride,
		resetBuiltinModeToDefault,
		isBuiltinModeOverridden,
		getEffectiveBuiltinMode,
		getAllEffectiveModes,
	} = useCustomModes()
	const { settings, setSettings } = useSettings()
	const { getRAGEngine } = useRAG()
	const diffStrategy = useDiffStrategy()

	const promptGenerator = useMemo(() => {
		return new PromptGenerator(getRAGEngine, app, settings, diffStrategy, customModePrompts, getAllEffectiveModes)
	}, [app, settings, diffStrategy, customModePrompts, getAllEffectiveModes])

	// Tab state
	const [activeTab, setActiveTab] = useState<'my-modes' | 'market'>('my-modes')

	// Market data state
	const [marketModes, setMarketModes] = useState<MarketMode[]>([])
	const [isLoadingMarket, setIsLoadingMarket] = useState(false)
	const [marketError, setMarketError] = useState<string | null>(null)

	// Currently selected mode
	const [selectedMode, setSelectedMode] = useState<string>('ask')
	const [isBuiltinMode, setIsBuiltinMode] = useState<boolean>(true)


	const isNewMode = React.useMemo(() => selectedMode === "add_new_mode", [selectedMode])

	// New mode configuration
	const [newMode, setNewMode] = useState<CustomMode>({
		id: '',
		slug: '',
		name: '',
		roleDefinition: '',
		customInstructions: '',
		tools: [],
		strategy: "ask",
		icon: 'command',
		enabled: true,
		source: 'global',
		updatedAt: 0,
		schemaVersion: 1,
	})

	// Custom mode ID
	const [customModeId, setCustomModeId] = useState<string>('')

	// Mode name
	const [modeName, setModeName] = useState<string>('')

	// Role definition
	const [roleDefinition, setRoleDefinition] = useState<string>('')

	// Selected tool groups
	const [selectedTools, setSelectedTools] = useState<string[]>([]);

	// Mode strategy
	const [modeStrategy, setModeStrategy] = useState<"ask" | "write" | "research" | "raw">("ask")

	// Custom instructions
	const [customInstructions, setCustomInstructions] = useState<string>('')

	// Mode icon
	const [modeIcon, setModeIcon] = useState<string>('command')

	// Mode enabled status
	const [modeEnabled, setModeEnabled] = useState<boolean>(true)

	// Local state for prompt settings path to avoid updating settings on every keystroke
	const [localPromptSettingsPath, setLocalPromptSettingsPath] = useState<string>(settings.infioPromptSettingsPath || '')

	// Sync local prompt settings path when global settings change
	useEffect(() => {
		setLocalPromptSettingsPath(settings.infioPromptSettingsPath || '')
	}, [settings.infioPromptSettingsPath])

	// Update form data when mode changes
	useEffect(() => {
		//  new mode
		if (isNewMode) {
			setIsBuiltinMode(false);
			setModeName(newMode.name);
			setRoleDefinition(newMode.roleDefinition);
			setCustomInstructions(newMode.customInstructions || '');
			setSelectedTools(newMode.tools);
			setModeStrategy(newMode.strategy || "ask");
			setModeIcon(newMode.icon || 'command');
			setModeEnabled(newMode.enabled ?? true);
			setCustomModeId('');
			return;
		}

		const builtinMode = buildinModes.find(m => m.slug === selectedMode);
		if (builtinMode) {
			setIsBuiltinMode(true);
			
			// Get effective builtin mode (with overrides)
			const effectiveMode = getEffectiveBuiltinMode(selectedMode);
			if (effectiveMode) {
				setModeName(effectiveMode.name);
				setRoleDefinition(effectiveMode.roleDefinition);
				setCustomInstructions(effectiveMode.customInstructions || '');
				setSelectedTools([...effectiveMode.tools]);
				setModeStrategy(effectiveMode.strategy || builtinMode.strategy || "ask");
				setModeIcon(effectiveMode.icon || 'command');
				setModeEnabled(effectiveMode.enabled ?? true);
				setCustomModeId(effectiveMode.id || '');
			}
		} else {
			setIsBuiltinMode(false);
			const customMode = customModeList.find(m => m.slug === selectedMode);
			if (customMode) {
				setCustomModeId(customMode.id || '');
				setModeName(customMode.name);
				setRoleDefinition(customMode.roleDefinition);
				setCustomInstructions(customMode.customInstructions || '');
				setSelectedTools(customMode.tools);
				setModeStrategy(customMode.strategy || "ask");
				setModeIcon(customMode.icon || 'command');
				setModeEnabled(customMode.enabled ?? true);
			} else {
				console.error("custom mode not found")
			}
		}
	}, [selectedMode, customModeList, builtinModeOverrides, getEffectiveBuiltinMode]);

	// Open settings tab
	const openSettingsTab = () => {
		try {
			// Use proper interface for Obsidian app with settings
			interface AppWithSettings {
				setting?: {
					open(): void
					openTabById(id: string): void
				}
			}
			const appWithSettings = app as AppWithSettings
			if (appWithSettings.setting) {
				appWithSettings.setting.open()
				appWithSettings.setting.openTabById('infio-copilot')
			}
		} catch (error) {
			console.error('Failed to open settings:', error)
		}
	}

	// Fetch market prompts data
	const fetchMarketPrompts = React.useCallback(async () => {
		if (!settings.infioProvider.apiKey) {
			setMarketError('请先配置 Infio API Key')
			return
		}

		setIsLoadingMarket(true)
		setMarketError(null)

		try {
			const response: ApiPromptResponse = await fetchPromptsList(settings.infioProvider.apiKey)
			console.log(response)

			// Transform API response to MarketMode format
			const transformedModes: MarketMode[] = (response.data || []).map((item: ApiPromptItem) => ({
				slug: item.slug,
				name: item.name,
				description: item.description,
				roleDefinition: item.roleDefinition,
				customInstructions: item.customInstructions,
				tools: item.tools,
				strategy: item.strategy || "ask",
				category: item.category || [],
				icon: item.icon,
				downloads: item.downloads
			}))

			setMarketModes(transformedModes)
		} catch (error) {
			console.error('Failed to fetch market prompts:', error)
			setMarketError(error instanceof Error ? error.message : '获取市场数据失败')
		} finally {
			setIsLoadingMarket(false)
		}
	}, [settings.infioProvider.apiKey])

	// Fetch market data when market tab is active
	useEffect(() => {
		if (activeTab === 'market' && marketModes.length === 0 && !isLoadingMarket) {
			fetchMarketPrompts()
		}
	}, [activeTab, marketModes.length, isLoadingMarket, fetchMarketPrompts]);


	// Handle tool selection change
	const handleToolChange = React.useCallback((tool: string) => {
		if (isNewMode) {
			setNewMode((prev) => ({
				...prev,
				tools: prev.tools.includes(tool) ? prev.tools.filter(t => t !== tool) : [...prev.tools, tool]
			}))
		}
		setSelectedTools(prev => {
			if (prev.includes(tool)) {
				return prev.filter(t => t !== tool);
			} else {
				return [...prev, tool];
			}
		});
	}, [isNewMode])

	// Handle icon change
	const handleIconChange = React.useCallback((icon: string) => {
		if (isNewMode) {
			setNewMode((prev) => ({
				...prev,
				icon
			}))
		}
		setModeIcon(icon);
	}, [isNewMode])

	// Save prompt settings path to global settings
	const savePromptSettingsPath = React.useCallback(() => {
		if (localPromptSettingsPath !== settings.infioPromptSettingsPath) {
			setSettings({ ...settings, infioPromptSettingsPath: localPromptSettingsPath });
		}
	}, [localPromptSettingsPath, settings, setSettings]);

	// Update mode configuration
	const handleUpdateMode = React.useCallback(async () => {
		// Save prompt settings path first
		savePromptSettingsPath();
		
		if (isBuiltinMode) {
			// Update builtin mode override
			await createOrUpdateBuiltinModeOverride(
				selectedMode,
				modeName,
				roleDefinition,
				customInstructions,
				selectedTools,
				modeStrategy,
				modeIcon,
				modeEnabled
			);
		} else {
			// Update custom mode
			await updateCustomMode(
				customModeId,
				modeName,
				roleDefinition,
				customInstructions,
				selectedTools,
				modeStrategy,
				modeIcon,
				modeEnabled
			);
		}
		// Show success notification
		new Notice(t('notifications.customModeSaved') as string);
	}, [isBuiltinMode, selectedMode, customModeId, modeName, roleDefinition, customInstructions, selectedTools, modeStrategy, modeIcon, modeEnabled, createOrUpdateBuiltinModeOverride, updateCustomMode, savePromptSettingsPath])

	// Create new mode
	const createNewMode = React.useCallback(async () => {
		if (!isNewMode) return;
		
		// Save prompt settings path first
		savePromptSettingsPath();
		
		await createCustomMode(
			modeName,
			roleDefinition,
			customInstructions,
			selectedTools,
			modeStrategy,
			modeIcon,
			modeEnabled
		);
		// Show success notification
		new Notice(t('notifications.customModeCreated'));
		// reset
		setNewMode({
			id: '',
			slug: '',
			name: '',
			roleDefinition: '',
			customInstructions: '',
			tools: [],
			strategy: "ask",
			icon: 'command',
			enabled: true,
			source: 'global',
			updatedAt: 0,
			schemaVersion: 1,
		})
		setSelectedMode("add_new_mode")
	}, [isNewMode, modeName, roleDefinition, customInstructions, selectedTools, modeStrategy, modeIcon, modeEnabled, createCustomMode, savePromptSettingsPath])

	// Delete mode
	const deleteMode = React.useCallback(async () => {
		if (isNewMode || isBuiltinMode) return;
		await deleteCustomMode(customModeId);
		setModeName('')
		setRoleDefinition('')
		setCustomInstructions('')
		setSelectedTools([])
		setModeIcon('command')
		setModeEnabled(true)
		setSelectedMode('add_new_mode')
	}, [isNewMode, isBuiltinMode, customModeId, deleteCustomMode])

	// Reset builtin mode to default
	const resetBuiltinMode = React.useCallback(async () => {
		if (!isBuiltinMode) return;
		await resetBuiltinModeToDefault(selectedMode);
		
		// Refresh the form with default values
		const originalBuiltin = buildinModes.find(m => m.slug === selectedMode);
		if (originalBuiltin) {
			setModeName(originalBuiltin.name);
			setRoleDefinition(originalBuiltin.roleDefinition);
			setCustomInstructions(originalBuiltin.customInstructions || '');
			setSelectedTools(originalBuiltin.tools.slice());
			setModeIcon(originalBuiltin.icon || 'command');
			setModeEnabled(true);
		}
	}, [isBuiltinMode, selectedMode, resetBuiltinModeToDefault])

	// Toggle builtin mode enabled
	const toggleBuiltinModeEnabled = React.useCallback(async () => {
		if (!isBuiltinMode) return;
		
		const newEnabledState = !modeEnabled;
		setModeEnabled(newEnabledState);
		
		// Create or update the override with the new enabled state
		await createOrUpdateBuiltinModeOverride(
			selectedMode,
			modeName,
			roleDefinition,
			customInstructions,
			selectedTools,
			modeStrategy,
			modeIcon,
			newEnabledState
		);
	}, [isBuiltinMode, selectedMode, modeName, roleDefinition, customInstructions, selectedTools, modeStrategy, modeIcon, modeEnabled, createOrUpdateBuiltinModeOverride])

	// Install market mode - fixed version
	const handleInstallMarketMode = async (marketMode: MarketMode) => {
		try {
			console.log(marketMode)
			await createCustomMode(
				marketMode.name,
				marketMode.roleDefinition,
				marketMode.customInstructions || '',
				marketMode.tools,
				marketMode.strategy || "ask",
				marketMode.icon || 'command',
				true // enabled parameter
			);
			
			// Show success notification
			new Notice(`已成功安装模式: ${marketMode.name}`);
			
			// Switch to my-modes tab and refresh the list
			setActiveTab('my-modes');
			
			// Don't try to select the mode immediately as the slug will be different
			// The user can select it manually from the list
		} catch (error) {
			console.error('Failed to install market mode:', error);
			new Notice(`安装模式失败: ${error instanceof Error ? error.message : '未知错误'}`);
		}
	}

	return (
		<div className="infio-custom-modes-container">
			{/* Mode configuration title and buttons */}
			<div className="infio-custom-modes-header">
				<div className="infio-custom-modes-title">
					<h2>{t('prompt.title')}</h2>
				</div>
			</div>

			{/* Tabs */}
			<div className="infio-commands-tabs">
				<button
					className={`infio-commands-tab-button ${activeTab === 'my-modes' ? 'active' : ''}`}
					onClick={() => setActiveTab('my-modes')}
				>
					我的模式 ({customModeList.length})
				</button>
				<button
					className={`infio-commands-tab-button ${activeTab === 'market' ? 'active' : ''}`}
					onClick={() => setActiveTab('market')}
				>
					市场 ({marketModes.length})
				</button>
			</div>

			{/* Tab content */}
			<div className="infio-commands-tab-content">
				{activeTab === 'my-modes' && (
					<>
						{/* Mode selection area */}
						<div className="infio-custom-modes-builtin">
							{[...buildinModes, ...customModeList].map(mode => {
								const IconComponent = getIconComponent('icon' in mode ? mode.icon : undefined);
								const isBuiltin = buildinModes.some(builtinMode => builtinMode.slug === mode.slug);
								return (
									<button
										key={mode.slug}
										className={`infio-mode-btn ${selectedMode === mode.slug ? 'active' : ''} ${isBuiltin ? 'builtin' : 'custom'}`}
										onClick={() => { setSelectedMode(mode.slug) }}
									>
										<IconComponent size={14} />
										{mode.name}
									</button>
								);
							})}
							<button
								key={"add_new_mode"}
								className={`infio-mode-btn ${selectedMode === "add_new_mode" ? 'active' : ''}`}
								onClick={() => setSelectedMode("add_new_mode")}
							>
								<Plus size={18} />
							</button>
						</div>

						{/* Mode name and icon */}
						<div className="infio-custom-modes-section infio-main-section">
							<div className="infio-section-header">
								<h3>{t('prompt.modeName')}</h3>
								<div className="infio-section-header-actions">
									<div className="infio-switch-container">
										<span className="infio-switch-label">启用</span>
										<Switch.Root
											checked={modeEnabled}
											onCheckedChange={(checked: boolean) => {
												if (isNewMode) {
													setNewMode((prev) => ({ ...prev, enabled: checked }))
													setModeEnabled(checked)
												} else if (isBuiltinMode) {
													toggleBuiltinModeEnabled()
												} else if (customModeId) {
													setModeEnabled(checked)
													toggleCustomModeEnabled(customModeId)
												}
											}}
											className="infio-mode-switch"
										>
											<Switch.Thumb className="infio-mode-switch-thumb" />
										</Switch.Root>
									</div>
									{isBuiltinMode && isBuiltinModeOverridden(selectedMode) && (
										<button 
											className="infio-section-btn" 
											onClick={resetBuiltinMode}
											title="重置到默认配置"
										>
											<Undo2 size={16} />
										</button>
									)}
									{!isBuiltinMode && !isNewMode && (
										<button className="infio-section-btn" onClick={deleteMode}>
											<Trash2 size={16} />
										</button>
									)}
								</div>
							</div>
							{
								isBuiltinMode ? (
									<p className="infio-section-subtitle">
										{isBuiltinModeOverridden(selectedMode) 
											? '已自定义的内置模式 - 修改后将保存为覆盖配置' 
											: '内置模式 - 修改后将创建覆盖配置'}
									</p>
								) : (
									<p className="infio-section-subtitle">
										{t('prompt.modeNameRequirements')}
									</p>
								)
							}
							<div className="infio-mode-name-icon-row">
								<div className="infio-mode-icon-selector">
									<IconSelector
										selectedIcon={modeIcon}
										onIconSelect={handleIconChange}
										size={14}
										className="infio-mode-icon-selector-btn"
									/>
								</div>
								<input
									type="text"
									value={modeName}
									onChange={(e) => {
										if (isNewMode) {
											setNewMode((prev) => ({ ...prev, name: e.target.value }))
										}
										setModeName(e.target.value)
									}}
									className="infio-custom-modes-input"
									placeholder={t('prompt.modeNamePlaceholder')}
								/>
							</div>
						</div>

						{/* Role definition */}
						<div className="infio-custom-modes-section infio-main-section">
							<div className="infio-section-header">
								<h3>{t('prompt.roleDefinition')}</h3>
								{isBuiltinMode && isBuiltinModeOverridden(selectedMode) && (
									<button 
										className="infio-section-btn"
										onClick={() => {
											const originalBuiltin = buildinModes.find(m => m.slug === selectedMode);
											if (originalBuiltin) {
												setRoleDefinition(originalBuiltin.roleDefinition);
											}
										}}
										title="恢复默认角色定义"
									>
										<Undo2 size={16} />
									</button>
								)}
							</div>
							<p className="infio-section-subtitle">{t('prompt.roleDefinitionDescription')}</p>
							<textarea
								className="infio-custom-textarea"
								value={roleDefinition}
								onChange={(e) => {
									if (isNewMode) {
										setNewMode((prev) => ({ ...prev, roleDefinition: e.target.value }))
									}
									setRoleDefinition(e.target.value)
								}}
								placeholder={t('prompt.roleDefinitionPlaceholder')}
							/>
						</div>

						{/* Strategy selection */}
						<div className="infio-custom-modes-section infio-main-section">
							<div className="infio-section-header">
								<h3>系统提示策略</h3>
								{isBuiltinMode && isBuiltinModeOverridden(selectedMode) && (
									<button 
										className="infio-section-btn"
										onClick={() => {
											const originalBuiltin = buildinModes.find(m => m.slug === selectedMode);
											if (originalBuiltin) {
												setModeStrategy(originalBuiltin.strategy || "ask");
											}
										}}
										title="恢复默认策略配置"
									>
										<Undo2 size={16} />
									</button>
								)}
							</div>
							<p className="infio-section-subtitle">选择系统提示的生成策略，不同策略适用于不同的使用场景</p>
							<select
								className="infio-select"
								value={modeStrategy}
								onChange={(e) => {
									const strategy = e.target.value as "ask" | "write" | "research" | "raw";
									if (isNewMode) {
										setNewMode((prev) => ({ ...prev, strategy: strategy }))
									}
									setModeStrategy(strategy)
								}}
							>
								<option value="ask">Ask - 问答交互模式</option>
								<option value="write">Write - 写作编辑模式</option>
								<option value="research">Research - 研究分析模式</option>
								<option value="raw">Raw - 原始模式</option>
							</select>
						</div>

						{/* Available tools */}
						<div className="infio-custom-modes-section infio-main-section">
							<div className="infio-section-header">
								<h3>可用工具</h3>
								{isBuiltinMode && isBuiltinModeOverridden(selectedMode) && (
									<button 
										className="infio-section-btn"
										onClick={() => {
											const originalBuiltin = buildinModes.find(m => m.slug === selectedMode);
											if (originalBuiltin) {
												setSelectedTools(originalBuiltin.tools.slice());
											}
										}}
										title="恢复默认工具配置"
									>
										<Undo2 size={16} />
									</button>
								)}
							</div>
							{
								isBuiltinMode && !isBuiltinModeOverridden(selectedMode) && (
									<p className="infio-section-subtitle">修改内置模式的工具配置将创建覆盖配置</p>
								)
							}
							<div className="infio-tools-list">
								{getAllAvailableTools().map(tool => (
									<div key={tool} className="infio-tool-item">
										<label>
											<input
												type="checkbox"
												checked={selectedTools.includes(tool)}
												onChange={() => handleToolChange(tool)}
											/>
											{tool}
										</label>
									</div>
								))}
							</div>
						</div>

						{/* Mode-specific rules */}
						<div className="infio-custom-modes-section infio-main-section">
							<div className="infio-section-header">
								<h3>{t('prompt.modeSpecificRules')}</h3>
								{isBuiltinMode && isBuiltinModeOverridden(selectedMode) && (
									<button 
										className="infio-section-btn"
										onClick={() => {
											const originalBuiltin = buildinModes.find(m => m.slug === selectedMode);
											if (originalBuiltin) {
												setCustomInstructions(originalBuiltin.customInstructions || '');
											}
										}}
										title="恢复默认自定义指令"
									>
										<Undo2 size={16} />
									</button>
								)}
							</div>
							<p className="infio-section-subtitle">{t('prompt.modeSpecificRulesDescription')}</p>
							<textarea
								className="infio-custom-textarea"
								value={customInstructions}
								onChange={(e) => {
									if (isNewMode) {
										setNewMode((prev) => ({ ...prev, customInstructions: e.target.value }))
									}
									setCustomInstructions(e.target.value)
								}}
								placeholder={t('prompt.modeSpecificRulesPlaceholder')}
							/>
							<p className="infio-section-footer">
								{t('prompt.supportReadingConfig')}<a href="#" className="infio-link" onClick={() => openOrCreateMarkdownFile(app, `${settings.infioPromptSettingsPath}/${modeName}/rules.md`, 0)}>{settings.infioPromptSettingsPath}/{modeName}/rules</a> {t('prompt.file')}
							</p>
						</div>

						{/* Override system prompt */}
						<div className="infio-custom-modes-section">
							<div className="infio-section-header">
								<h3>{t('prompt.overrideSystemPrompt')}</h3>
							</div>
							<p className="infio-section-subtitle">
								{t('prompt.overrideDescription')}
								<a href="#" className="infio-link" onClick={() => openOrCreateMarkdownFile(app, `${settings.infioPromptSettingsPath}/${modeName}/system_prompt.md`, 0)}>{settings.infioPromptSettingsPath}/{modeName}/system_prompt</a>
								{t('prompt.overrideWarning')}
								<button
									className="infio-preview-btn"
									onClick={async () => {
										let filesSearchMethod = settings.filesSearchSettings.method
										if (filesSearchMethod === 'auto' && settings.embeddingModelId && settings.embeddingModelId !== '') {
											filesSearchMethod = 'semantic'
										}

										const userLanguage = getFullLanguageName(getLanguage())
										// Use selectedMode (slug) instead of modeName for system prompt generation
										const systemPrompt = await promptGenerator.getSystemMessageNew(selectedMode, filesSearchMethod, userLanguage)
										const existingLeaf = app.workspace
											.getLeavesOfType(PREVIEW_VIEW_TYPE)
											.find(
												(leaf) =>
													leaf.view instanceof PreviewView && leaf.view.state.title === `${modeName} system prompt`
											)
										if (existingLeaf) {
											app.workspace.setActiveLeaf(existingLeaf, { focus: true })
										} else {
											app.workspace.getLeaf(true).setViewState({
												type: PREVIEW_VIEW_TYPE,
												active: true,
												state: {
													content: typeof systemPrompt.content === 'string' ? systemPrompt.content : '',
													title: `${modeName} system prompt`,
												} satisfies PreviewViewState,
											})
										}
									}
									}
								>
									{t('prompt.previewSystemPrompt')}
								</button>
							</p>
						</div>

						{/* Prompt Settings Path Configuration */}
						<div className="infio-custom-modes-section">
							<div className="infio-section-header">
								<h3>{t('prompt.promptSettingsPath')}</h3>
							</div>
							<p className="infio-section-subtitle">{t('prompt.promptSettingsPathDescription')}</p>
							<input
								type="text"
								value={localPromptSettingsPath}
								onChange={(e) => {
									setLocalPromptSettingsPath(e.target.value);
								}}
								className="infio-custom-modes-input"
								placeholder={t('prompt.promptSettingsPathPlaceholder')}
							/>
						</div>

						{/* Save */}
						<div className="infio-custom-modes-actions">
							<button
								className="infio-preview-btn"
								onClick={() => {
									if (isNewMode) {
										createNewMode()
									} else {
										handleUpdateMode()
									}
								}}
							>
								{t('prompt.save')}
							</button>
						</div>
					</>
				)}

				{activeTab === 'market' && (
					<div className="infio-market-modes-list">
						{isLoadingMarket ? (
							<div className="infio-market-empty">
								<p>加载中...</p>
							</div>
						) : marketError ? (
							<div className="infio-market-empty">
								<p>{marketError}</p>
								{marketError.includes('API Key') && (
									<button
										onClick={openSettingsTab}
										className="infio-market-config-button infio-market-error-action-button"
									>
										配置 API Key
									</button>
								)}
								<button
									onClick={fetchMarketPrompts}
									disabled={isLoadingMarket}
									className="infio-market-config-button infio-market-retry-button"
								>
									重试
								</button>
							</div>
						) : marketModes.length === 0 ? (
							<div className="infio-market-empty">
								<p>未找到提示模式</p>
							</div>
						) : (
							marketModes.map(mode => {
								const IconComponent = getIconComponent(mode.icon);
								return (
									<div key={mode.slug} className="infio-market-mode-item">
										<div className="infio-market-mode-header">
											<div className="infio-market-mode-info">
												<div className="infio-market-mode-name">
													<IconComponent size={16} />
													{mode.name}
												</div>
												<div className="infio-market-mode-meta">
													<div className="infio-market-mode-strategy">{mode.strategy}</div>
													<div className="infio-market-mode-categories">
														{mode.category.map((cat) => (
															<span key={cat} className="infio-market-mode-category">
																{cat}
															</span>
														))}
													</div>
												</div>
											</div>
											<button
												onClick={() => handleInstallMarketMode(mode)}
												className="infio-commands-install-btn"
												title="一键安装到我的模式"
											>
												<Download size={16} />
											</button>
										</div>
										<div className="infio-market-mode-description">{mode.description}</div>
									</div>
								);
							})
						)}
					</div>
				)}
			</div>

			{/* Styles */}
			<style>
				{`
				.infio-custom-modes-container {
					display: flex;
					flex-direction: column;
					padding: 16px;
					gap: 16px;
  				color: var(--text-normal);
					height: 100%;
					overflow-y: auto;
				}

				.infio-custom-modes-input {
				  background-color: var(--background-primary) !important;
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: var(--size-4-2);
					font-size: var(--font-ui-small);
					width: 100%;
					box-sizing: border-box;
					flex: 1;
					height: 36px; /* 设置固定高度确保对齐 */
				}
				
				.infio-custom-modes-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}
				
				.infio-custom-modes-title h2 {
					margin: 0;
					font-size: 24px;
				}
				
				.infio-custom-modes-actions {
					display: flex;
					gap: 8px;
				}
				
				.infio-custom-modes-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					background: transparent;
					border: 1px solid #444;
					color: var(--text-normal)
					border-radius: 4px;
					padding: 6px;
					cursor: pointer;
				}
				
				.infio-custom-modes-tip {
					color: #888;
					font-size: 14px;
					margin-bottom: 8px;
				}
				
				.infio-custom-modes-builtin {
					display: flex;
					flex-wrap: wrap;
					gap: 10px;
					margin-bottom: 10px;
				}
				
				.infio-mode-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: var(--size-2-2);
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					border: none;
					border-radius: var(--radius-s);
					padding: var(--size-2-3) var(--size-4-3);
					cursor: pointer;
					font-size: var(--font-ui-small);
					align-self: flex-start;
					margin-top: var(--size-4-2);
				}
				
				.infio-mode-btn.active {
					background-color: var(--text-accent);
				}

				/* Built-in mode styling */
				.infio-mode-btn.builtin {
					background-color: var(--background-primary);
					color: var(--text-normal);
					border: 1px solid var(--background-modifier-border);
				}

				.infio-mode-btn.builtin.active {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					border-color: var(--interactive-accent);
				}

				/* Custom mode styling - slightly lighter than builtin */
				.infio-mode-btn.custom {
					background-color: var(--background-modifier-hover);
					color: var(--text-normal);
					border: 1px solid var(--background-modifier-border-hover);
				}

				.infio-mode-btn.custom.active {
					background-color: var(--text-accent);
					color: var(--text-on-accent);
					border-color: var(--text-accent);
				}
				
				.infio-custom-modes-custom {
					display: flex;
					flex-wrap: wrap;
					gap: 10px;
					margin-bottom: 16px;
				}
				
				.infio-mode-btn-custom {
					background-color: transparent;
					border: 1px solid #444;
					border-radius: 4px;
					padding: 6px 12px;
					color: #888;
					cursor: pointer;
					font-size: 14px;
				}
				
				.infio-mode-btn-custom.active {
					background-color: var(--text-accent);
					border-color: var(--text-accent);
					color: var(--text-normal);
				}
				
				.infio-custom-modes-section {
					margin-bottom: 16px;
				}

				.infio-main-section {
					border: 1px solid var(--background-modifier-border);
					border-radius: 12px;
					padding: 16px;
					background-color: var(--background-primary);
					box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
					transition: border-color 0.2s ease, box-shadow 0.2s ease;
				}

				.infio-main-section:hover {
					border-color: var(--interactive-accent);
					box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
				}
				
				.infio-section-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: 4px;
				}
				
				.infio-section-header h3 {
					margin: 0;
					font-size: 16px;
				}
				
				.infio-section-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					background-color: transparent !important;
					border: none !important;
					box-shadow: none !important;
					color: var(--text-muted);
					padding: 0 !important;
					margin: 0 !important;
					width: 24px !important;
					height: 24px !important;

					&:hover {
						background-color: var(--background-modifier-hover) !important;
					}
				}
				
				.infio-section-subtitle {
					color: #888;
					font-size: 14px;
					margin: 4px 0 12px;
				}
				
				.infio-custom-textarea {
					background-color: var(--background-primary) !important;
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: var(--size-4-2);
					font-size: var(--font-ui-small);
					width: 100%;
					min-height: 160px;
					resize: vertical;
					box-sizing: border-box;
				}
				
				.infio-select {
					background-color: var(--background-primary) !important;
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: var(--size-4-2);
					font-size: var(--font-ui-small);
					width: 100%;
					box-sizing: border-box;
					height: 36px;
				}
				
				.infio-tools-list {
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 10px;
				}
				
				.infio-tool-item {
					display: flex;
					align-items: center;
				}
				
				.infio-tool-item label {
					display: flex;
					align-items: center;
					gap: 8px;
					cursor: pointer;
				}
				
				.infio-code-section {
					border: 1px solid #444;
					border-radius: 4px;
					padding: 8px;
					margin-bottom: 12px;
				}
				
				.infio-code-header {
					display: flex;
					align-items: center;
					gap: 8px;
					margin-bottom: 8px;
					color: #888;
				}
				
				.infio-section-footer {
					margin-top: 0px;
					font-size: 14px;
					color: #888;
				}
				
				.infio-link {
					color: var(--text-accent);
					text-decoration: none;
				}
				
				.infio-preview-btn {
					border: 1px solid #444;
					color: var(--text-normal);
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					width: fit-content;
				}



				/* Market modes styles */
				.infio-market-modes-list {
					display: flex;
					flex-direction: column;
					gap: 16px;
				}

				.infio-market-mode-item {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: 16px;
					transition: border-color 0.2s ease;
				}

				.infio-market-mode-item:hover {
					border-color: var(--background-modifier-border-hover);
				}

				.infio-market-mode-header {
					display: flex;
					justify-content: space-between;
					align-items: flex-start;
					margin-bottom: 12px;
				}

				.infio-market-mode-info {
					flex: 1;
				}

				.infio-market-mode-name {
					font-size: 16px;
					font-weight: 600;
					color: var(--text-normal);
					margin-bottom: 4px;
				}

				.infio-market-mode-category {
					font-size: 12px;
					color: var(--text-muted);
					background-color: var(--background-modifier-border);
					padding: 2px 8px;
					border-radius: var(--radius-s);
					display: inline-block;
				}

				.infio-market-install-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 6px;
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					border: none;
					border-radius: var(--radius-s);
					padding: 8px 12px;
					cursor: pointer;
					font-size: 14px;
					transition: background-color 0.2s ease;
				}

				.infio-market-install-btn:hover {
					background-color: var(--interactive-accent-hover);
				}

				.infio-market-mode-description {
					color: var(--text-muted);
					font-size: 14px;
					line-height: 1.4;
				}

				/* Market empty state */
				.infio-market-empty {
					text-align: center;
					padding: 40px 20px;
					color: var(--text-muted);
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
				}

				.infio-market-config-button {
					display: flex;
					align-items: center;
					gap: 8px;
					background-color: var(--interactive-normal);
					color: var(--text-normal);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: 8px 16px;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s ease;
					margin: 0 auto;
				}

				.infio-market-config-button:hover {
					background-color: var(--interactive-hover);
					border-color: var(--interactive-accent);
				}

				.infio-market-error-action-button {
					margin-top: 12px;
				}

				.infio-market-retry-button {
					margin-top: 8px;
				}

				/* Market mode meta info */
				.infio-market-mode-meta {
					display: flex;
					gap: 12px;
					font-size: 12px;
					color: var(--text-muted);
					align-items: center;
				}

				.infio-market-mode-strategy {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					padding: 2px 8px;
					border-radius: var(--radius-s);
					font-weight: 500;
				}

				.infio-market-mode-downloads {
					color: var(--text-accent);
				}

				/* Mode name and icon row */
				.infio-mode-name-icon-row {
					display: flex;
					align-items: center;
				}

				.infio-mode-icon-selector {
					flex-shrink: 0;
				}

				.infio-mode-icon-selector-btn {
					display: flex;
					align-items: center;
					justify-content: center;
				}

				/* Market mode name with icon */
				.infio-market-mode-name {
					display: flex;
					align-items: center;
					gap: 8px;
				}

				/* Icon selector styles */
				.infio-icon-selector {
					position: relative;
					display: inline-block;
				}

				.infio-icon-selector-button {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: 8px;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: background-color 0.2s ease;
					height: 36px; /* 与输入框保持相同高度 */
					width: 36px; /* 设置为正方形 */
					box-sizing: border-box;
				}

				.infio-icon-selector-button:hover {
					background-color: var(--background-modifier-hover);
				}

				.infio-icon-selector-dropdown {
					position: absolute;
					top: 100%;
					left: 0;
					z-index: 1000;
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					box-shadow: var(--shadow-s);
					padding: 8px;
					margin-top: 4px;
					max-height: 200px;
					overflow-y: auto;
				}

				.infio-icon-selector-grid {
					display: grid;
					grid-template-columns: repeat(6, 1fr);
					gap: 4px;
				}

				.infio-icon-selector-option {
					background-color: transparent;
					border: 1px solid transparent;
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: 6px;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;
				}

				.infio-icon-selector-option:hover {
					background-color: var(--background-modifier-hover);
					border-color: var(--background-modifier-border);
				}

				.infio-icon-selector-option.selected {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					border-color: var(--interactive-accent);
				}


				/* Switch styles - based on Radix UI official example, compact size */
				button.infio-mode-switch {
					all: unset;
					width: 32px;
					height: 18px;
					background-color: var(--background-modifier-border);
					border-radius: 9999px;
					position: relative;
					box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
					-webkit-tap-highlight-color: rgba(0, 0, 0, 0);
				}

				button.infio-mode-switch:focus {
					box-shadow: 0 0 0 1px var(--interactive-accent);
				}

				button.infio-mode-switch[data-state="checked"] {
					background-color: var(--interactive-accent);
				}

				.infio-mode-switch-thumb {
					display: block;
					width: 14px;
					height: 14px;
					background-color: white;
					border-radius: 9999px;
					box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
					transition: transform 100ms;
					transform: translateX(2px);
					will-change: transform;
				}

				.infio-mode-switch-thumb[data-state="checked"] {
					transform: translateX(16px);
				}

				/* Section header actions */
				.infio-section-header-actions {
					display: flex;
					align-items: center;
					gap: 8px;
				}

				.infio-switch-container {
					display: flex;
					align-items: center;
					gap: 6px;
				}

				.infio-switch-label {
					font-size: 14px;
					color: var(--text-muted);
				}
				/* Market mode categories container */
				.infio-market-mode-categories {
					display: flex;
					gap: 6px;
					flex-wrap: wrap;
				}

				.infio-market-mode-category {
					font-size: 12px;
					color: var(--text-muted);
					background-color: var(--background-modifier-border);
					padding: 2px 8px;
					border-radius: var(--radius-s);
					display: inline-block;
				}
				`}
			</style>
		</div>
	)
}

export default CustomModeView
