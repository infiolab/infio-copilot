import React from 'react';

import { t } from '../../lang/helpers';
import InfioPlugin from "../../main";
import { ApiProvider } from '../../types/llm/model';
import { InfioSettings } from '../../types/settings';
import { GetAllProviders, GetDefaultModelId, GetEmbeddingProviders } from '../../utils/api';
import { getProviderApiUrl } from '../../utils/provider-urls';

import { ApiKeyComponent, CustomUrlComponent } from './FormComponents';
import { ComboBoxComponent } from './ProviderModelsPicker';

type CustomProviderSettingsProps = {
	plugin: InfioPlugin;
	onSettingsUpdate?: () => void;
}

type ProviderSettingKey =
	| 'infioProvider'
	| 'openrouterProvider'
	| 'openaiProvider'
	| 'siliconflowProvider'
	| 'alibabaQwenProvider'
	| 'anthropicProvider'
	| 'deepseekProvider'
	| 'googleProvider'
	| 'groqProvider'
	| 'grokProvider'
	| 'ollamaProvider'
	| 'openaicompatibleProvider';

const keyMap: Record<ApiProvider, ProviderSettingKey> = {
	'Infio': 'infioProvider',
	'OpenRouter': 'openrouterProvider',
	'OpenAI': 'openaiProvider',
	'SiliconFlow': 'siliconflowProvider',
	'AlibabaQwen': 'alibabaQwenProvider',
	'Anthropic': 'anthropicProvider',
	'Deepseek': 'deepseekProvider',
	'Google': 'googleProvider',
	'Groq': 'groqProvider',
	'Grok': 'grokProvider',
	'Ollama': 'ollamaProvider',
	'OpenAICompatible': 'openaicompatibleProvider',
};

const getProviderSettingKey = (provider: ApiProvider): ProviderSettingKey => {
	return keyMap[provider];
};

const CustomProviderSettings: React.FC<CustomProviderSettingsProps> = ({ plugin, onSettingsUpdate }) => {
	const settings = plugin.settings;
	const activeTab = settings.activeProviderTab || ApiProvider.Infio;

	const handleSettingsUpdate = async (newSettings: InfioSettings) => {
		await plugin.setSettings(newSettings);
		onSettingsUpdate?.();
	};

	const setActiveTab = (provider: ApiProvider) => {
		const newSettings = {
			...settings,
			activeProviderTab: provider
		};
		handleSettingsUpdate(newSettings);
	};

	const providers = GetAllProviders(); // 按照重要程度排序
	const embeddingProviders = GetEmbeddingProviders(); // 按照重要程度排序

	// 获取已设置API Key的提供商列表
	const getSettedProviders = (): ApiProvider[] => {
		return providers.filter(provider => {			
			const providerSetting = getProviderSetting(provider);
			return providerSetting.apiKey && providerSetting.apiKey.trim() !== '';
		});
	};

	// 一键配置模型
	const handleOneClickConfig = () => {
		const settedProviders = getSettedProviders();
		
		if (settedProviders.length === 0) {
			// 提示用户未设置任何key
			alert(t("settings.ModelProvider.noApiKeySet"));
			return;
		}

		// 选择chat和autocomplete的提供商（按providers排序选择最靠前的）
		const selectedProvider = providers.find(provider => settedProviders.includes(provider));
		
		// 选择embedding的提供商（按embeddingProviders排序选择最靠前的）
		const embeddingProvider = embeddingProviders.find(provider => settedProviders.includes(provider));

		// 准备要更新的设置对象
		const newSettings = { ...settings };
		let hasUpdates = false;

		if (selectedProvider) {
			const defaultModels = GetDefaultModelId(selectedProvider);
			
			// 设置chat和autocomplete模型
			if (defaultModels.chat) {
				newSettings.chatModelProvider = selectedProvider;
				newSettings.chatModelId = defaultModels.chat;
				hasUpdates = true;
				console.log(t("settings.ModelProvider.chatModelConfigured", { provider: selectedProvider, model: defaultModels.chat }));
			}
			if (defaultModels.autoComplete) {
				newSettings.applyModelProvider = selectedProvider;
				newSettings.applyModelId = defaultModels.autoComplete;
				hasUpdates = true;
				console.log(t("settings.ModelProvider.autocompleteModelConfigured", { provider: selectedProvider, model: defaultModels.autoComplete }));
			}
		}

		if (embeddingProvider) {
			const embeddingDefaultModels = GetDefaultModelId(embeddingProvider);
			
			// 设置embedding模型
			if (embeddingDefaultModels.embedding) {
				newSettings.embeddingModelProvider = embeddingProvider;
				newSettings.embeddingModelId = embeddingDefaultModels.embedding;
				hasUpdates = true;
				console.log(t("settings.ModelProvider.embeddingModelConfigured", { provider: embeddingProvider, model: embeddingDefaultModels.embedding }));
			}
		}

		// 一次性更新所有设置
		if (hasUpdates) {
			handleSettingsUpdate(newSettings);
		}
	};

	const updateProviderApiKey = (provider: ApiProvider, value: string) => {
		const providerKey = getProviderSettingKey(provider);
		const providerSettings = settings[providerKey];

		handleSettingsUpdate({
			...settings,
			[providerKey]: {
				...providerSettings,
				apiKey: value
			}
		});
	};

	const updateProviderUseCustomUrl = (provider: ApiProvider, value: boolean) => {
		const providerKey = getProviderSettingKey(provider);
		const providerSettings = settings[providerKey];

		handleSettingsUpdate({
			...settings,
			[providerKey]: {
				...providerSettings,
				useCustomUrl: value
			}
		});
	};

	const updateProviderBaseUrl = (provider: ApiProvider, value: string) => {
		const providerKey = getProviderSettingKey(provider);
		const providerSettings = settings[providerKey];

		handleSettingsUpdate({
			...settings,
			[providerKey]: {
				...providerSettings,
				baseUrl: value
			}
		});
	};

	const testApiConnection = async (provider: ApiProvider) => {
		console.log(`Testing connection for ${provider}...`);
		
		try {
			// 动态导入LLMManager以避免循环依赖
			const { default: LLMManager } = await import('../../core/llm/manager');
			const { GetDefaultModelId } = await import('../../utils/api');
			
			// 对于Ollama和OpenAICompatible，不支持测试API连接
			if (provider === ApiProvider.Ollama || provider === ApiProvider.OpenAICompatible) {
				throw new Error(t("settings.ModelProvider.testConnection.notSupported", { provider }));
			}
			
			// 创建LLM管理器实例
			const llmManager = new LLMManager(settings);
			
			// 获取提供商的默认聊天模型
			const defaultModels = GetDefaultModelId(provider);
			const testModelId = defaultModels.chat;
			
			// 对于没有默认模型的提供商，使用通用的测试模型
			if (!testModelId) {
				throw new Error(t("settings.ModelProvider.testConnection.noDefaultModel", { provider }));
			}
			
			// 构造测试模型对象
			const testModel = {
				provider: provider,
				modelId: testModelId
			};
			
			// 构造简单的测试请求
			const testRequest = {
				messages: [
					{
						role: 'user' as const,
						content: 'echo hi'
					}
				],
				model: testModelId,
				max_tokens: 10,
				temperature: 0
			};
			
			// 设置超时选项
			const abortController = new AbortController();
			const timeoutId = setTimeout(() => abortController.abort(), 10000); // 10秒超时
			
			try {
				// 发起API调用测试
				const response = await llmManager.generateResponse(
					testModel,
					testRequest,
					{ signal: abortController.signal }
				);
				
				clearTimeout(timeoutId);
				
				// 检查响应是否有效
				if (response && response.choices && response.choices.length > 0) {
					console.log(`✅ ${provider} connection test successful:`, response.choices[0]?.message?.content);
					// ApiKeyComponent expects no return value on success, just no thrown error
					return;
				} else {
					throw new Error(t("settings.ModelProvider.testConnection.invalidResponse"));
				}
			} catch (apiError) {
				clearTimeout(timeoutId);
				throw apiError;
			}
			
		} catch (error) {
			console.error(`❌ ${provider} connection test failed:`, error);
			
			// 根据错误类型提供更具体的错误信息
			let errorMessage = t("settings.ModelProvider.testConnection.connectionFailed");
			
			if (error.message?.includes('API key')) {
				errorMessage = t("settings.ModelProvider.testConnection.invalidApiKey");
			} else if (error.message?.includes('base URL') || error.message?.includes('baseURL')) {
				errorMessage = t("settings.ModelProvider.testConnection.invalidBaseUrl");
			} else if (error.message?.includes('timeout') || error.name === 'AbortError') {
				errorMessage = t("settings.ModelProvider.testConnection.requestTimeout");
			} else if (error.message?.includes('fetch')) {
				errorMessage = t("settings.ModelProvider.testConnection.networkError");
			} else if (error.message?.includes('401')) {
				errorMessage = t("settings.ModelProvider.testConnection.unauthorizedError");
			} else if (error.message?.includes('403')) {
				errorMessage = t("settings.ModelProvider.testConnection.forbiddenError");
			} else if (error.message?.includes('429')) {
				errorMessage = t("settings.ModelProvider.testConnection.rateLimitError");
			} else if (error.message?.includes('500')) {
				errorMessage = t("settings.ModelProvider.testConnection.serverError");
			} else if (error.message) {
				// 如果错误消息本身已经是翻译过的（比如不支持的提供商），直接使用
				if (error.message.includes(t("settings.ModelProvider.testConnection.notSupported", { provider: '' }).slice(0, 10))) {
					errorMessage = error.message;
				} else if (error.message.includes(t("settings.ModelProvider.testConnection.noDefaultModel", { provider: '' }).slice(0, 10))) {
					errorMessage = error.message;
				} else {
					errorMessage = error.message;
				}
			}
			alert(errorMessage);
			// 必须抛出错误，这样ApiKeyComponent才能正确显示失败状态
			throw new Error(errorMessage);
		}
	};

	const getProviderSetting = (provider: ApiProvider) => {
		const providerKey = getProviderSettingKey(provider);
		return settings[providerKey] || {};
	};

	const updateChatModelId = (provider: ApiProvider, modelId: string) => {
		handleSettingsUpdate({
			...settings,
			chatModelProvider: provider,
			chatModelId: modelId
		});
	};

	const updateApplyModelId = (provider: ApiProvider, modelId: string) => {
		handleSettingsUpdate({
			...settings,
			applyModelProvider: provider,
			applyModelId: modelId
		});
	};

	const updateEmbeddingModelId = (provider: ApiProvider, modelId: string) => {
		handleSettingsUpdate({
			...settings,
			embeddingModelProvider: provider,
			embeddingModelId: modelId
		});
	};

	// 生成包含链接的API Key描述
	const generateApiKeyDescription = (provider: ApiProvider): React.ReactNode => {
		const apiUrl = getProviderApiUrl(provider);
		const baseDescription = String(t("settings.ApiProvider.enterApiKeyDescription"));
		
		if (!apiUrl) {
			// 如果没有URL，直接移除占位符
			return baseDescription.replace('{provider_api_url}', '');
		}

		// 将占位符替换为实际的链接元素
		const parts = baseDescription.split('{provider_api_url}');
		if (parts.length !== 2) {
			return baseDescription;
		}

		return (
			<>
				{parts[0]}
				<a 
					href={apiUrl} 
					target="_blank" 
					rel="noopener noreferrer"
					className="provider-api-link"
				>
					{apiUrl}
				</a>
				{parts[1]}
			</>
		);
	};

	const renderProviderConfig = (provider: ApiProvider) => {
		const providerSetting = getProviderSetting(provider);

		return (
			<div className="provider-config">
				{provider !== ApiProvider.Ollama && (
					<ApiKeyComponent
						name={t("settings.ModelProvider.setApiKey", { provider })}
						placeholder={t("settings.ApiProvider.enterApiKey")}
						description={generateApiKeyDescription(provider)}
						value={providerSetting.apiKey || ''}
						onChange={(value) => updateProviderApiKey(provider, value)}
						onTest={() => testApiConnection(provider)}
					/>
				)}

				<CustomUrlComponent
					name={t("settings.ApiProvider.useCustomBaseUrl")}
					placeholder={t("settings.ApiProvider.enterCustomUrl")}
					useCustomUrl={providerSetting.useCustomUrl || false}
					baseUrl={providerSetting.baseUrl || ''}
					onToggleCustomUrl={(value) => updateProviderUseCustomUrl(provider, value)}
					onChangeBaseUrl={(value) => updateProviderBaseUrl(provider, value)}
				/>
			</div>
		);
	};

	return (
		<div className="provider-settings-container">
			{/* 提供商配置区域 */}
			<div className="provider-config-section">
				<h2 className="section-title">{t("settings.ApiProvider.label")}</h2>
				<p className="section-description">{t("settings.ApiProvider.labelDescription")}</p>
				{/* 提供商标签页 */}
				<div className="provider-tabs">
					{providers.map((provider) => (
						<button
							key={provider}
							className={`provider-tab ${activeTab === provider ? 'active' : ''}`}
							onClick={() => setActiveTab(provider)}
						>
							{provider}
						</button>
					))}
				</div>

				{/* 当前选中提供商的配置 */}
				<div className="provider-config-content">
					{renderProviderConfig(activeTab)}
				</div>
			</div>

			{/* 模型选择区域 */}
			<div className="model-selection-section">
				<div className="model-selection-header">
					<h2 className="section-title">{t("settings.ModelProvider.modelSelection")}:</h2>
					<button 
						className="one-click-config-btn"
						onClick={handleOneClickConfig}
						title={t("settings.ModelProvider.oneClickConfigTooltip")}
					>
						{t("settings.ModelProvider.oneClickConfig")}
					</button>
				</div>

				<div className="model-selectors">
					<ComboBoxComponent
						name={t("settings.Models.chatModel")}
						description={t("settings.Models.chatModelDescription")}
						settings={settings}
						provider={settings.chatModelProvider || ApiProvider.OpenAI}
						modelId={settings.chatModelId}
						updateModel={updateChatModelId}
					/>

					<ComboBoxComponent
						name={t("settings.Models.autocompleteModel")}
						description={t("settings.Models.autocompleteModelDescription")}
						settings={settings}
						provider={settings.applyModelProvider || ApiProvider.OpenAI}
						modelId={settings.applyModelId}
						updateModel={updateApplyModelId}
					/>

					<ComboBoxComponent
						name={t("settings.Models.embeddingModel")}
						description={t("settings.Models.embeddingModelDescription")}
						settings={settings}
						provider={settings.embeddingModelProvider || ApiProvider.Google}
						modelId={settings.embeddingModelId}
						isEmbedding={true}
						updateModel={updateEmbeddingModelId}
					/>
				</div>
			</div>

			<style>
				{`
				/* 主容器样式 */
				.provider-settings-container {
					display: flex;
					flex-direction: column;
					gap: var(--size-4-6);
				}

				/* 区域样式 */
				.provider-config-section,
				.model-selection-section {
					background: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-m);
					padding: var(--size-4-4);
				}

				/* 标题样式 */
				.section-title {
					font-size: var(--font-ui-medium);
					font-weight: var(--font-weight-semibold);
					color: var(--text-normal);
					margin: 0 0 var(--size-4-3) 0;
					padding-bottom: var(--size-2-2);
					border-bottom: 1px solid var(--background-modifier-border);
				}

				/* 模型选择区域头部样式 */
				.model-selection-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					margin-bottom: var(--size-4-3);
				}

				.model-selection-header .section-title {
					margin: 0;
					padding-bottom: 0;
					border-bottom: none;
				}

				/* 一键配置按钮样式 */
				.one-click-config-btn {
					background: var(--interactive-accent);
					color: var(--text-on-accent);
					border: none;
					border-radius: var(--radius-s);
					padding: var(--size-2-1) var(--size-4-2);
					font-size: var(--font-ui-smaller);
					font-weight: var(--font-weight-medium);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
				}

				.one-click-config-btn:hover {
					background: var(--interactive-accent-hover);
					box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
				}

				.one-click-config-btn:active {
					transform: translateY(1px);
					box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
				}

				/* 提供商标签页容器 */
				.provider-tabs {
					display: flex;
					flex-wrap: wrap;
					gap: var(--size-2-2);
					margin-bottom: var(--size-4-4);
					padding-bottom: var(--size-4-3);
					border-bottom: 1px solid var(--background-modifier-border);
				}

				/* 提供商标签页按钮 */
				.provider-tab {
					padding: var(--size-2-2) var(--size-4-2);
					background: var(--background-secondary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					font-size: var(--font-ui-small);
					font-weight: var(--font-weight-medium);
					color: var(--text-muted);
					outline: none;
				}

				.provider-tab:hover {
					background: var(--background-modifier-hover);
					color: var(--text-normal);
				}

				.provider-tab.active {
					background: var(--interactive-accent);
					border-color: var(--interactive-accent);
					color: var(--text-on-accent);
					box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
					font-weight: var(--font-weight-semibold);
				}

				.provider-tab.active:hover {
					background: var(--interactive-accent-hover);
					border-color: var(--interactive-accent-hover);
				}

				/* 提供商配置内容 */
				.provider-config-content {
					min-height: 120px;
				}

				.provider-config {
					display: flex;
					flex-direction: column;
					gap: var(--size-4-2);
				}

				/* 模型选择器容器 */
				.model-selectors {
					display: flex;
					flex-direction: column;
					gap: var(--size-4-3);
				}

				/* 分隔线 */
				.setting-divider {
					height: 1px;
					background: var(--background-modifier-border);
					margin: var(--size-2-2) 0;
					opacity: 0.5;
				}

				/* 响应式设计 */
				@media (max-width: 768px) {
					.provider-settings-container {
						gap: var(--size-4-3);
					}
					
					.provider-config-section,
					.model-selection-section {
						padding: var(--size-4-2);
					}
					
					.provider-tabs {
						gap: var(--size-2-1);
					}
					
					.provider-tab {
						padding: var(--size-2-1) var(--size-4-1);
						font-size: var(--font-ui-smaller);
					}

					.model-selection-header {
						flex-direction: column;
						align-items: flex-start;
						gap: var(--size-2-2);
					}
				}

				/* 提供商名称高亮样式 */
				.provider-name-highlight {
					color: var(--interactive-accent);
					font-weight: var(--font-weight-medium);
				}

				/* API 链接样式 */
				.provider-api-link {
					color: var(--text-accent);
					text-decoration: underline;
				}

				.provider-api-link:hover {
					color: var(--text-accent-hover);
				}

				/* 深色模式适配 */
				.theme-dark .provider-tab {
					background: var(--background-secondary-alt);
				}

				.theme-dark .provider-tab:hover {
					background: var(--background-modifier-hover);
				}

				.theme-dark .provider-tab.active {
					background: var(--interactive-accent);
					color: var(--text-on-accent);
				}

				.theme-dark .provider-tab.active:hover {
					background: var(--interactive-accent-hover);
				}

				.theme-dark .provider-config-section,
				.theme-dark .model-selection-section {
					background: var(--background-primary-alt);
					border-color: var(--background-modifier-border-hover);
				}
				`}
			</style>
		</div>
	);
};

export default CustomProviderSettings;
