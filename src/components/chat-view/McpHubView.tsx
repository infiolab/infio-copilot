import { AlertTriangle, ChevronDown, ChevronRight, Download, ExternalLink, FileText, Folder, Power, RotateCcw, Trash2, Wrench } from 'lucide-react'
import { Notice } from 'obsidian'
import React, { useEffect, useState } from 'react'

import { useApp } from '../../contexts/AppContext'
import { useMcpHub } from '../../contexts/McpHubContext'
import { useSettings } from '../../contexts/SettingsContext'
import { McpErrorEntry, McpResource, McpResourceTemplate, McpServer, McpTool } from '../../core/mcp/type'
import { IconSelector } from '../../hooks/use-icon-selector'
import { fetchMcpsList } from '../../hooks/use-infio'
import { t } from '../../lang/helpers'

// API Response types
interface ApiMcpItem {
	id?: string
	name?: string
	description?: string
	category?: string
	author?: string
	version?: string
	downloads?: number
	config?: string
	package?: string
	icon?: string
	from?: string
	tools?: ApiMcpTool[]
}

interface ApiMcpTool {
	name?: string
	description?: string
	parameters?: string[]
}

interface ApiMcpResponse {
	data?: ApiMcpItem[]
}

// Market MCP Server from API
interface MarketMcpServer {
	id: string
	name: string
	description: string
	category: string
	author: string
	version: string
	downloads?: number
	config: string
	icon?: string
	from?: string
	tools: MarketMcpTool[]
}

interface MarketMcpTool {
	name: string
	description: string
	parameters?: string[]
}

const McpHubView = () => {
	const app = useApp()
	const { settings, setSettings } = useSettings()
	const { getMcpHub } = useMcpHub()
	const [mcpServers, setMcpServers] = useState<McpServer[]>([])
	const [expandedServers, setExpandedServers] = useState<Record<string, boolean>>({});
	const [activeServerDetailTab, setActiveServerDetailTab] = useState<Record<string, 'tools' | 'resources' | 'errors'>>({});

	// Market data state
	const [marketMcpServers, setMarketMcpServers] = useState<MarketMcpServer[]>([])
	const [isLoadingMarket, setIsLoadingMarket] = useState(false)
	const [marketError, setMarketError] = useState<string | null>(null)

	// Tab state
	const [activeTab, setActiveTab] = useState<'my-servers' | 'market'>('my-servers')

	// 新增状态变量用于创建新服务器
	const [newServerFullConfig, setNewServerFullConfig] = useState('')
	const [isCreateSectionExpanded, setIsCreateSectionExpanded] = useState(false)

	const fetchServers = async () => {
		const hub = await getMcpHub()
		if (hub) {
			const serversData = hub.getAllServers()
			setMcpServers(serversData)
		}
	}

	const fetchMarketMcpServers = async () => {
		if (!settings.infioProvider.apiKey) {
			setMarketError('请先配置 Infio API Key')
			return
		}

		setIsLoadingMarket(true)
		setMarketError(null)

		try {
			const response: ApiMcpResponse = await fetchMcpsList(settings.infioProvider.apiKey)

			// Transform API response to MarketMcpServer format
			const transformedServers: MarketMcpServer[] = (response.data || []).map((item: ApiMcpItem) => ({
				id: item.id || item.name || 'unknown-id',
				name: item.name || 'Unknown',
				description: item.description || 'No description available',
				category: item.category || 'Uncategorized',
				author: item.author || 'Unknown',
				version: item.version || '1.0.0',
				downloads: item.downloads || 0,
				config: typeof item.config === 'string' ? item.config : JSON.stringify(item.config || {}),
				icon: item.icon,
				from: item.from,
				tools: (item.tools || []).map((tool: ApiMcpTool) => ({
					name: tool.name || 'unknown',
					description: tool.description || 'No description',
					parameters: tool.parameters || []
				}))
			}))

			setMarketMcpServers(transformedServers)
		} catch (error) {
			console.error('Failed to fetch market MCP servers:', error)
			setMarketError(error instanceof Error ? error.message : '获取市场数据失败')
		} finally {
			setIsLoadingMarket(false)
		}
	}

	useEffect(() => {
		fetchServers()
	}, [getMcpHub])

	useEffect(() => {
		if (activeTab === 'market' && marketMcpServers.length === 0 && !isLoadingMarket) {
			fetchMarketMcpServers()
		}
	}, [activeTab, settings.infioProvider.apiKey])

	const switchMcp = React.useCallback(() => {
		setSettings({
			...settings,
			mcpEnabled: !settings.mcpEnabled,
		})
	}, [settings, setSettings])

	// const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
	// 	setSearchTerm(e.target.value)
	// }

	const handleRestart = async (serverName: string) => {
		const hub = await getMcpHub();
		if (hub) {
			await hub.restartConnection(serverName, "global")
			const updatedServers = hub.getAllServers()
			setMcpServers(updatedServers)
		}
	}

	const handleToggle = async (serverName: string, disabled: boolean) => {
		const hub = await getMcpHub();
		if (hub) {
			await hub.toggleServerDisabled(serverName, !disabled)
			const updatedServers = hub.getAllServers()
			setMcpServers(updatedServers)
		}
	}

	const handleDelete = async (serverName: string) => {
		const hub = await getMcpHub();
		if (hub) {
			const deleteConfirmText = t('mcpHub.deleteConfirm').replace('{name}', serverName)
			if (confirm(typeof deleteConfirmText === 'string' ? deleteConfirmText : String(deleteConfirmText))) {
				await hub.deleteServer(serverName, "global")
				const updatedServers = hub.getAllServers()
				setMcpServers(updatedServers)
			}
		}
	}

	const handleCreate = async () => {
		// 验证输入
		const configString = typeof newServerFullConfig === 'string' ? newServerFullConfig : JSON.stringify(newServerFullConfig || {})

		if (configString.trim().length === 0) {
			const message = t('mcpHub.configRequired')
			new Notice(typeof message === 'string' ? message : String(message))
			return
		}

		// 解析完整配置，提取服务器名称和配置
		let parsedConfig: Record<string, unknown>
		try {
			const parsed = JSON.parse(configString)
			// 验证配置格式
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				new Notice('配置必须是一个JSON对象', 5000)
				return
			}
			parsedConfig = parsed
		} catch (error) {
			new Notice('配置不是有效的JSON格式', 5000)
			return
		}

		const serverNames = Object.keys(parsedConfig)
		if (serverNames.length === 0) {
			new Notice('配置中没有找到服务器定义', 5000)
			return
		}

		if (serverNames.length > 1) {
			new Notice('每次只能创建一个服务器，配置中包含多个服务器定义', 5000)
			return
		}

		const serverName = serverNames[0]
		const serverConfig = parsedConfig[serverName]

		// 验证服务器配置的必需字段
		if (typeof serverConfig !== 'object' || serverConfig === null) {
			new Notice('服务器配置必须是一个对象', 5000)
			return
		}

		const config = serverConfig as Record<string, unknown>
		const hasCommand = 'command' in config && config.command !== undefined
		const hasUrl = 'url' in config && config.url !== undefined

		if (!hasCommand && !hasUrl) {
			new Notice('MCP服务器配置必须包含 "command"（用于命令行执行）或 "url"（用于服务器连接）字段', 8000)
			return
		}

		const hub = await getMcpHub();
		if (hub) {
			try {
				await hub.createServer(serverName, JSON.stringify(serverConfig), "global")
				const updatedServers = hub.getAllServers()
				setMcpServers(updatedServers)

				// 清空表单
				setNewServerFullConfig('')
				const successMessage = t('mcpHub.createSuccess').replace('{name}', serverName)
				new Notice(typeof successMessage === 'string' ? successMessage : String(successMessage))
			} catch (error) {
				const errorMessage = t('mcpHub.createFailed').replace('{error}', error instanceof Error ? error.message : String(error))
				new Notice(typeof errorMessage === 'string' ? errorMessage : String(errorMessage))
			}
		}
	}

	const handleOpenConfigFile = async () => {
		const hub = await getMcpHub();
		if (hub) {
			try {
				await hub.openMcpSettingsFile();
			} catch (error) {
				console.error('Failed to open config file:', error)
			}
		}
	}

	const toggleServerExpansion = (serverKey: string) => {
		setExpandedServers(prev => ({ ...prev, [serverKey]: !prev[serverKey] }));
		if (!expandedServers[serverKey] && !activeServerDetailTab[serverKey]) {
			setActiveServerDetailTab(prev => ({ ...prev, [serverKey]: 'tools' }));
		}
	};

	const handleDetailTabChange = (serverKey: string, tab: 'tools' | 'resources' | 'errors') => {
		setActiveServerDetailTab(prev => ({ ...prev, [serverKey]: tab }));
	};

	const toggleCreateSectionExpansion = () => {
		setIsCreateSectionExpanded(prev => !prev)
	}

	const openSettingsTab = () => {
		// Open Infio plugin settings
		try {
			// Use proper interface for Obsidian app with settings
			interface AppWithSettings {
				setting?: {
					open(): void
					openTabById(id: string): void
				}
			}
			const appWithSettings = app as unknown as AppWithSettings
			if (appWithSettings.setting) {
				appWithSettings.setting.open()
				appWithSettings.setting.openTabById('infio-copilot')
			}
		} catch (error) {
			console.error('Failed to open settings:', error)
		}
	}

	// Install market MCP server
	const handleInstallMarketServer = async (marketServer: MarketMcpServer) => {
		const hub = await getMcpHub();
		if (!hub) {
			new Notice('MCP Hub 不可用')
			return
		}

		// 验证输入
		const configString = typeof marketServer.config === 'string' ? marketServer.config : JSON.stringify(marketServer.config || {})

		if (configString.trim().length === 0) {
			new Notice('市场服务器配置为空')
			return
		}

		// 解析完整配置，提取服务器名称和配置
		let parsedConfig: Record<string, unknown>
		try {
			const parsed = JSON.parse(configString)
			// 验证配置格式
			if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
				new Notice('配置必须是一个JSON对象', 5000)
				return
			}
			parsedConfig = parsed
		} catch (error) {
			new Notice('配置不是有效的JSON格式', 5000)
			return
		}

		const serverNames = Object.keys(parsedConfig)
		if (serverNames.length === 0) {
			new Notice('配置中没有找到服务器定义', 5000)
			return
		}

		if (serverNames.length > 1) {
			new Notice('每次只能创建一个服务器，配置中包含多个服务器定义', 5000)
			return
		}

		const serverName = serverNames[0]
		const serverConfig = parsedConfig[serverName]

		// 验证服务器配置的必需字段
		if (typeof serverConfig !== 'object' || serverConfig === null) {
			new Notice('服务器配置必须是一个对象', 5000)
			return
		}

		const config = serverConfig as Record<string, unknown>
		const hasCommand = 'command' in config && config.command !== undefined
		const hasUrl = 'url' in config && config.url !== undefined

		if (!hasCommand && !hasUrl) {
			new Notice('MCP服务器配置必须包含 "command"（用于命令行执行）或 "url"（用于服务器连接）字段', 8000)
			return
		}

		try {
			await hub.createServer(serverName, JSON.stringify(serverConfig), "global")
			const updatedServers = hub.getAllServers()
			setMcpServers(updatedServers)

			const successMessage = t('mcpHub.createSuccess').replace('{name}', serverName)
			new Notice(typeof successMessage === 'string' ? successMessage : String(successMessage))

			// 切换到我的服务器标签页显示安装结果
			setActiveTab('my-servers')
		} catch (error) {
			const errorMessage = t('mcpHub.createFailed').replace('{error}', error instanceof Error ? error.message : String(error))
			new Notice(typeof errorMessage === 'string' ? errorMessage : String(errorMessage))
		}
	}

	const ToolRow = ({ tool }: { tool: McpTool }) => {
		return (
			<div className="infio-mcp-tool-row">
				<div className="infio-mcp-tool-row-header">
					<div className="infio-mcp-tool-name-section">
						<span className="infio-mcp-tool-name">{tool.name}</span>
					</div>
				</div>
				{tool.description && (
					<p className="infio-mcp-item-description">{tool.description}</p>
				)}
				{(tool.inputSchema && (() => {
					const schema = tool.inputSchema;
					const properties = schema && typeof schema === 'object' && 'properties' in schema ? schema.properties : undefined;
					const required = schema && typeof schema === 'object' && 'required' in schema ? schema.required : undefined;

					if (properties && typeof properties === 'object' && Object.keys(properties).length > 0) {
						return (
							<div className="infio-mcp-tool-parameters">
								<h5 className="infio-mcp-parameters-title">{t('mcpHub.parameters')}</h5>
								{Object.entries(properties).map(
									([paramName, paramSchemaUntyped]) => {
										const paramSchema = paramSchemaUntyped && typeof paramSchemaUntyped === 'object' ? paramSchemaUntyped : {};
										const paramDescription = 'description' in paramSchema && typeof paramSchema.description === 'string' ? paramSchema.description : undefined;
										const isRequired = required && Array.isArray(required) && required.includes(paramName);
										return (
											<div key={paramName} className="infio-mcp-parameter-item">
												<code className="infio-mcp-parameter-name">
													{paramName}
													{isRequired && <span className="infio-mcp-parameter-required">*</span>}
												</code>
												<span className="infio-mcp-parameter-description">
													{paramDescription || t('mcpHub.toolNoDescription')}
												</span>
											</div>
										);
									}
								)}
							</div>
						);
					}
					return null;
				})())}
			</div>
		);
	};

	const ResourceRow = ({ resource }: { resource: McpResource | McpResourceTemplate }) => (
		<div className="infio-mcp-resource-row">
			<div className="infio-mcp-resource-header">
				<FileText size={16} className="infio-mcp-resource-icon" />
				<strong>{'uri' in resource ? resource.uri : resource.uriTemplate}</strong>
			</div>
			{resource.description && <p className="infio-mcp-item-description">{resource.description}</p>}
		</div>
	);

	const ErrorRow = ({ error }: { error: McpErrorEntry }) => (
		<div className="infio-mcp-error-row">
			<div className="infio-mcp-error-header">
				<AlertTriangle size={16} className="infio-mcp-error-icon" />
				<p style={{ color: error.level === 'error' ? 'var(--text-error)' : error.level === 'warn' ? 'var(--text-warning)' : 'var(--text-normal)' }}>
					{error.message}
				</p>
			</div>
			<p className="infio-mcp-item-timestamp">{new Date(error.timestamp).toLocaleString()}</p>
		</div>
	);

	const MarketServerRow = ({ server }: { server: MarketMcpServer }) => (
		<div className="infio-mcp-market-item">
			<div className="infio-mcp-market-header">
				<div className="infio-mcp-market-info">
					<div className="infio-mcp-market-name">
						<IconSelector selectedIcon={server.icon} onIconSelect={() => { }} size={16} />
						<span>{server.name}</span>
					</div>
					<div className="infio-mcp-market-meta">
						<span className="infio-mcp-market-category">{server.category}</span>
						<span className="infio-mcp-market-author">by {server.author}</span>
						{server.from && (
							<span className="infio-mcp-market-downloads">

								<a
									href={server.from}
									target="_blank"
									rel="noopener noreferrer"
									className="infio-mcp-market-from"
									title="访问来源"
								>
									<ExternalLink size={12} />
									source
								</a>
							</span>
						)}
					</div>
				</div>
				<button
					onClick={() => handleInstallMarketServer(server)}
					className="infio-commands-install-btn"
					title="一键安装到我的服务器"
				>
					<Download size={16} />
				</button>
			</div>
			<div className="infio-mcp-market-description">{server.description}</div>
		</div>
	);

	return (
		<div className="infio-mcp-hub-container">
			{/* Header Section */}
			<div className="infio-mcp-hub-header">
				<h3 className="infio-mcp-hub-title">{t('mcpHub.title')}</h3>
				<div className="infio-mcp-hub-actions">
					<button
						onClick={fetchServers}
						className="obsidian-insight-refresh-btn"
					>
						<RotateCcw size={16} />
					</button>
				</div>
			</div>

			{/* Tabs */}
			<div className="infio-commands-tabs">
				<button
					className={`infio-commands-tab-button ${activeTab === 'my-servers' ? 'active' : ''}`}
					onClick={() => setActiveTab('my-servers')}
				>
					我的服务器 ({mcpServers.length})
				</button>
				<button
					className={`infio-commands-tab-button ${activeTab === 'market' ? 'active' : ''}`}
					onClick={() => setActiveTab('market')}
				>
					MCP 市场 ({marketMcpServers.length})
				</button>
			</div>

			{/* Tab Content */}
			<div className="infio-commands-tab-content">
				{activeTab === 'my-servers' && (
					<>
						{/* MCP Settings */}
						<div className="infio-mcp-settings-section">
							<div className="infio-mcp-setting-item">
								<label className="infio-mcp-setting-label">
									<input
										type="checkbox"
										checked={settings.mcpEnabled}
										onChange={switchMcp}
										className="infio-mcp-setting-checkbox"
									/>
									<span className="infio-mcp-setting-text">{t('mcpHub.enableMcp')}</span>
								</label>
								<p className="infio-mcp-setting-description">
									{t('mcpHub.enableMcpDescription')}
									<a href="https://modelcontextprotocol.io/introduction" target="_blank" rel="noopener noreferrer">
										{t('mcpHub.learnMore')}
									</a>
								</p>
							</div>

							{/* Configuration File Access */}
							<button
								onClick={handleOpenConfigFile}
								className="infio-mcp-config-button"
							>
								<ExternalLink size={16} />
								<span>{t('mcpHub.openConfigFile')}</span>
							</button>
						</div>

						{/* Create New Server Section */}
						{settings.mcpEnabled && (
							<div className="infio-mcp-create-section">
								<div className="infio-mcp-create-item">
									<div className="infio-mcp-create-item-header" onClick={toggleCreateSectionExpansion}>
										<div className="infio-mcp-create-item-info">
											<div className="infio-mcp-hub-expander">
												{isCreateSectionExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
											</div>
											<h3 className="infio-mcp-create-title">{t('mcpHub.addNewServer')}</h3>
										</div>
									</div>

									{isCreateSectionExpanded && (
										<div className="infio-mcp-create-expanded">
											<div className="infio-mcp-create-label">服务器配置（完整JSON格式）</div>
											<textarea
												value={newServerFullConfig}
												onChange={(e) => setNewServerFullConfig(e.target.value)}
												placeholder={`{
  "server-name": {
    "command": "node",
    "args": ["server.js"],
    "disabled": false
  }
}`}
												className="infio-mcp-create-textarea"
												rows={8}
											/>
											<div className="infio-mcp-create-help">
												<p>配置格式说明：</p>
												<ul>
													<li>必须包含 <code>command</code>（命令行方式）或 <code>url</code>（服务器方式）</li>
													<li>服务器名称作为JSON对象的key</li>
													<li>可选字段：<code>args</code>, <code>env</code>, <code>disabled</code>, <code>alwaysAllow</code></li>
												</ul>
											</div>
											<button
												onClick={handleCreate}
												className="infio-mcp-create-btn"
												disabled={!newServerFullConfig.trim()}
											>
												<span>{t('mcpHub.createServer')}</span>
											</button>
										</div>
									)}
								</div>
							</div>
						)}

						{/* Servers List */}
						{settings.mcpEnabled && (
							<div className="infio-mcp-hub-list">
								{mcpServers.length === 0 ? (
									<div className="infio-mcp-hub-empty">
										<p>{t('mcpHub.noServersFound')}</p>
									</div>
								) : (
									mcpServers.map(server => {
										// Add null check for server object
										if (!server || !server.name) {
											return null;
										}

										const serverKey = `${server.name}-${server.source || 'global'}`;
										const isExpanded = !!expandedServers[serverKey];
										const currentDetailTab = activeServerDetailTab[serverKey] || 'tools';

										return (
											<div key={serverKey} className={`infio-mcp-hub-item ${server.disabled ? 'disabled' : ''}`}>
												<div className={`infio-mcp-hub-item-header ${server.disabled ? 'disabled' : ''}`}>
													<div className="infio-mcp-hub-item-info" onClick={() => toggleServerExpansion(serverKey)}>
														<div className="infio-mcp-hub-expander">
															{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
														</div>
														<span className={`infio-mcp-hub-status-indicator ${server.status === 'connected' ? 'connected' : server.status === 'connecting' ? 'connecting' : 'disconnected'} ${server.disabled ? 'disabled' : ''}`}></span>
														<h3 className="infio-mcp-hub-name">{server.name ? server.name.replace('infio-builtin-server', 'builtin') : 'Unknown Server'}</h3>
													</div>

													<div className="infio-mcp-hub-actions" onClick={(e) => e.stopPropagation()}>
														<button
															className={`infio-section-btn ${server.disabled ? 'disabled' : 'enabled'}`}
															onClick={() => handleToggle(server.name, server.disabled)}
															title={server.disabled ? t('mcpHub.enable') : t('mcpHub.disable')}
														>
															<Power size={16} />
														</button>

														<button
															className="infio-section-btn"
															onClick={() => handleRestart(server.name)}
															title={t('mcpHub.restart')}
														>
															<RotateCcw size={16} />
														</button>

														<button
															className="infio-section-btn"
															onClick={() => handleDelete(server.name)}
															title={t('mcpHub.delete')}
														>
															<Trash2 size={16} />
														</button>
													</div>
												</div>

												<div className="infio-mcp-hub-status-info">
													<span className="infio-mcp-status-text">
														{t('mcpHub.status')}: <span className={`status-value ${server.status}`}>
															{server.status === 'connected' ? t('mcpHub.statusConnected') :
																server.status === 'connecting' ? t('mcpHub.statusConnecting') :
																	t('mcpHub.statusDisconnected')}
														</span>
													</span>
												</div>

												{isExpanded && server.status === 'connected' && (
													<div className="infio-mcp-server-details-expanded">
														<div className="infio-mcp-tabs">
															{(['tools', 'resources', 'errors'] as const).map(tabName => {
																const count = tabName === 'tools'
																	? server.tools?.length || 0
																	: tabName === 'resources'
																		? (server.resources?.length || 0) + (server.resourceTemplates?.length || 0)
																		: server.errorHistory?.length || 0;

																return (
																	<button
																		key={tabName}
																		className={`infio-mcp-tab-button ${currentDetailTab === tabName ? 'active' : ''}`}
																		onClick={(e) => { e.stopPropagation(); handleDetailTabChange(serverKey, tabName); }}
																	>
																		{tabName === 'tools' && <Wrench size={14} />}
																		{tabName === 'resources' && <Folder size={14} />}
																		{tabName === 'errors' && <AlertTriangle size={14} />}
																		{t(`mcpHub.${tabName}`)} ({count})
																	</button>
																);
															})}
														</div>
														<div className="infio-mcp-tab-content">
															{currentDetailTab === 'tools' && (
																<div className="infio-mcp-tools-list">
																	{(server.tools && server.tools.length > 0) ? server.tools.filter(tool => tool && tool.name).map(tool => <ToolRow key={tool.name} tool={tool} />) : <p className="infio-mcp-empty-message">{t('mcpHub.noTools')}</p>}
																</div>
															)}
															{currentDetailTab === 'resources' && (
																<div className="infio-mcp-resources-list">
																	{((server.resources && server.resources.length > 0) || (server.resourceTemplates && server.resourceTemplates.length > 0))
																		? [...(server.resources || []), ...(server.resourceTemplates || [])].map(res => <ResourceRow key={'uri' in res ? res.uri : res.uriTemplate} resource={res} />)
																		: <p className="infio-mcp-empty-message">{t('mcpHub.noResources')}</p>}
																</div>
															)}
															{currentDetailTab === 'errors' && (
																<div className="infio-mcp-errors-list">
																	{(server.errorHistory && server.errorHistory.length > 0)
																		? [...server.errorHistory].sort((a, b) => b.timestamp - a.timestamp).map((err, idx) => <ErrorRow key={`${err.timestamp}-${idx}`} error={err} />)
																		: <p className="infio-mcp-empty-message">{t('mcpHub.noErrors')}</p>}
																</div>
															)}
														</div>
													</div>
												)}
												{isExpanded && server.status !== 'connected' && (
													<div className="infio-mcp-server-details-expanded">
														<p className="infio-mcp-server-error-message">
															{t('mcpHub.serverNotConnectedError')}
															{server.error && <pre>{server.error}</pre>}
														</p>
													</div>
												)}
											</div>
										);
									})
								)}
							</div>
						)}
					</>
				)}

				{activeTab === 'market' && (
					<div className="infio-mcp-market-list">
						{isLoadingMarket ? (
							<div className="infio-mcp-market-empty">
								<p>加载中...</p>
							</div>
						) : marketError ? (
							<div className="infio-mcp-market-empty">
								<p>{marketError}</p>
								{marketError.includes('API Key') && (
									<button
										onClick={openSettingsTab}
										className="infio-mcp-config-button infio-mcp-error-action-button"
									>
										配置 API Key
									</button>
								)}
								<button
									onClick={fetchMarketMcpServers}
									disabled={isLoadingMarket}
									className="infio-mcp-config-button infio-mcp-retry-button"
								>
									重试
								</button>
							</div>
						) : marketMcpServers.length === 0 ? (
							<div className="infio-mcp-market-empty">
								<p>未找到 MCP 服务器</p>
							</div>
						) : (
							marketMcpServers.map(server => (
								<MarketServerRow key={server.id} server={server} />
							))
						)}
					</div>
				)}
			</div>

			<style>{`
				.infio-mcp-hub-container {
					display: flex;
					flex-direction: column;
					padding: 16px;
					gap: 16px;
					color: var(--text-normal);
					scroll-behavior: smooth;
				}

				/* Header Styles */
				.infio-mcp-hub-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.infio-mcp-hub-title {
					margin: 0;
					font-size: 24px;
				}

				/* Settings Section */
				.infio-mcp-settings-section {
					background-color: var(--background-secondary);
					border-radius: var(--radius-s);
				}

				.infio-mcp-setting-item {
					margin-bottom: 12px;
				}

				.infio-mcp-setting-label {
					display: flex;
					align-items: flex-start;
					gap: 8px;
					cursor: pointer;
				}

				.infio-mcp-setting-checkbox {
					margin-top: 2px;
					cursor: pointer;
				}

				.infio-mcp-setting-text {
					font-weight: 500;
					color: var(--text-normal);
				}

				.infio-mcp-setting-description {
					margin: 8px 0 0 24px;
					font-size: 14px;
					color: var(--text-muted);
					line-height: 1.4;
				}

				.infio-mcp-hub-actions {
					display: flex;
					gap: var(--size-2-2);
				}

				.obsidian-insight-refresh-btn {
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

				.obsidian-insight-refresh-btn:hover:not(:disabled) {
					background-color: var(--interactive-hover);
				}

				.infio-mcp-config-button {
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
				}

				.infio-mcp-config-button:hover {
					background-color: var(--interactive-hover);
					border-color: var(--interactive-accent);
				}

				.infio-mcp-config-button:active {
					transform: translateY(1px);
				}

				/* Search Section */
				.infio-mcp-search-section {
					margin-bottom: 16px;
				}

				.infio-mcp-search-input {
					background-color: var(--background-primary) !important;
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: var(--size-4-2);
					font-size: var(--font-ui-small);
					width: 100%;
					box-sizing: border-box;
				}

				.infio-mcp-search-input:focus {
					outline: none;
					border-color: var(--interactive-accent);
				}

				/* Server Item Styles */
				.infio-mcp-hub-item {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					margin-bottom: 16px;
				}

				.infio-mcp-hub-item-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 8px;
					cursor: pointer;
					transition: all 0.2s ease;
				}

				.infio-mcp-hub-item-header:hover {
					background-color: var(--background-modifier-hover);
				}

				.infio-mcp-hub-item-header.disabled {
					opacity: 0.6;
					background-color: var(--background-modifier-border-hover);
				}

				.infio-mcp-hub-item-header.disabled:hover {
					background-color: var(--background-modifier-border-hover);
					opacity: 0.7;
				}

				.infio-mcp-hub-item-header.disabled .infio-mcp-hub-name,
				.infio-mcp-hub-item-header.disabled .infio-mcp-hub-expander {
					color: var(--text-faint);
				}

				.infio-mcp-hub-item-header.disabled .infio-mcp-hub-source-badge {
					background-color: var(--text-faint);
					color: var(--background-primary);
					opacity: 0.7;
				}

				.infio-mcp-hub-item-info {
					display: flex;
					align-items: center;
					gap: 12px;
					flex: 1;
				}

				.infio-mcp-hub-expander {
					color: var(--text-muted);
					font-size: 0.9em;
					width: 16px;
					height: 16px;
					display: flex;
					align-items: center;
					justify-content: center;
					flex-shrink: 0;
				}

				.infio-mcp-hub-status-indicator {
					width: 8px;
					height: 8px;
					border-radius: 50%;
					flex-shrink: 0;
					transition: all 0.2s ease;
				}

				.infio-mcp-hub-status-indicator.connected {
					background-color: #10b981;
				}

				.infio-mcp-hub-status-indicator.connecting {
					background-color: #f59e0b;
					animation: pulse 1.5s infinite;
				}

				.infio-mcp-hub-status-indicator.disconnected {
					background-color: #ef4444;
				}

				@keyframes pulse {
					0% {
						opacity: 1;
					}
					50% {
						opacity: 0.5;
					}
					100% {
						opacity: 1;
					}
				}

				.infio-mcp-hub-status-indicator.disabled.connected {
					background-color: #10b981;
					opacity: 0.4;
					filter: saturate(0.6);
				}

				.infio-mcp-hub-status-indicator.disabled.connecting {
					background-color: #f59e0b;
					opacity: 0.4;
					filter: saturate(0.6);
				}

				.infio-mcp-hub-status-indicator.disabled.disconnected {
					background-color: #ef4444;
					opacity: 0.4;
					filter: saturate(0.6);
				}

				.infio-mcp-hub-name {
					font-size: 16px;
					font-weight: 600;
					color: var(--text-normal);
					margin: 0;
				}

				.infio-mcp-hub-source-badge {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					padding: 2px 8px;
					border-radius: var(--radius-s);
					font-size: 12px;
					font-weight: 500;
					text-transform: uppercase;
				}

				.infio-mcp-hub-actions {
					display: flex;
					gap: 8px;
					align-items: center;
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

				.infio-section-btn:hover {
					color: var(--text-normal);
				}

				.infio-section-btn.enabled {
					color: var(--interactive-accent);
				}

				.infio-section-btn.disabled {
					color: var(--text-muted);
				}

				.infio-mcp-hub-status-info {
					padding: 8px;
					font-size: 14px;
					color: var(--text-muted);
				}

				.infio-mcp-hub-item.disabled .infio-mcp-hub-status-info {
					color: var(--text-faint);
				}

				.status-value.connected {
					color: #10b981;
					font-weight: 500;
				}

				.status-value.connecting {
					color: #f59e0b;
					font-weight: 500;
				}

				.status-value.disconnected {
					color: #ef4444;
					font-weight: 500;
				}

				.infio-mcp-hub-item.disabled .status-value.connected {
					color: #10b981;
					opacity: 0.5;
					filter: saturate(0.6);
				}

				.infio-mcp-hub-item.disabled .status-value.connecting {
					color: #f59e0b;
					opacity: 0.5;
					filter: saturate(0.6);
				}

				.infio-mcp-hub-item.disabled .status-value.disconnected {
					color: #ef4444;
					opacity: 0.5;
					filter: saturate(0.6);
				}

				/* Expanded Content Styles */
				.infio-mcp-server-details-expanded {
					border-top: 1px solid var(--background-modifier-border);
					background-color: var(--background-secondary);
					padding-top: 8px;
					padding-bottom: 16px;
					animation: expandContent 0.3s ease-out;
					border-bottom-left-radius: var(--radius-s);
					border-bottom-right-radius: var(--radius-s);
				}

				@keyframes expandContent {
					from {
						opacity: 0;
						transform: translateY(-10px);
					}
					to {
						opacity: 1;
						transform: translateY(0);
					}
				}

				.infio-mcp-tabs {
					display: flex;
					border-bottom: 1px solid var(--background-modifier-border);
					gap: 0;
				}

				.infio-mcp-tab-button {
					background: transparent;
					border: none;
					padding: 12px 20px;
					cursor: pointer;
					color: var(--text-muted);
					border-bottom: 2px solid transparent;
					font-size: 14px;
					font-weight: 500;
					transition: all 0.2s ease;
					border-radius: 0;
					display: flex;
					align-items: center;
					gap: 8px;
				}

				.infio-mcp-tab-button:hover {
					color: var(--text-normal);
					background-color: var(--background-modifier-hover);
				}

				.infio-mcp-tab-button.active {
					color: var(--interactive-accent);
					border-bottom-color: var(--interactive-accent);
					background-color: transparent;
				}

				.infio-mcp-tab-content {
					background-color: var(--background-primary);
					border-radius: var(--radius-s);
					padding: 8px;
					border: 1px solid var(--background-modifier-border);
				}

				.infio-mcp-empty-message {
					text-align: center;
					color: var(--text-muted);
					font-style: italic;
					padding: 20px;
				}

				/* Tool/Resource/Error Row Styles */
				.infio-mcp-tool-row, .infio-mcp-resource-row, .infio-mcp-error-row {
					padding: 12px;
					border-bottom: 1px solid var(--background-modifier-border);
					background-color: var(--background-primary);
					border-radius: var(--radius-s);
					margin-bottom: 8px;
				}

				.infio-mcp-tool-row:last-child,
				.infio-mcp-resource-row:last-child,
				.infio-mcp-error-row:last-child {
					border-bottom: none;
					margin-bottom: 0;
				}

				.infio-mcp-tool-row-header, .infio-mcp-resource-header, .infio-mcp-error-header {
					display: flex;
					align-items: center;
					gap: 8px;
					margin-bottom: 8px;
				}

				.infio-mcp-tool-name {
					font-weight: 600;
					color: var(--text-normal);
					font-size: 14px;
				}

				.infio-mcp-item-description {
					font-size: 14px;
					color: var(--text-muted);
					line-height: 1.4;
					margin: 8px 0 0 0;
				}

				/* Tool Parameters */
				.infio-mcp-tool-parameters {
					margin-top: 8px;
					padding: 8px;
					background-color: var(--background-secondary);
					border-radius: var(--radius-s);
					border: 1px solid var(--background-modifier-border);
				}

				.infio-mcp-parameters-title {
					font-size: 12px;
					font-weight: 600;
					text-transform: uppercase;
					color: var(--text-muted);
					margin: 0 0 8px 0;
				}

				.infio-mcp-parameter-item {
					margin-bottom: 8px;
					padding: 6px 0;
				}

				.infio-mcp-parameter-name {
					display: inline-block;
					background-color: var(--background-modifier-border);
					color: var(--text-accent);
					padding: 2px 6px;
					border-radius: 3px;
					font-family: var(--font-monospace);
					font-size: 12px;
					font-weight: 500;
					margin-bottom: 4px;
				}

				.infio-mcp-parameter-required {
					color: var(--text-error);
					margin-left: 2px;
				}

				.infio-mcp-parameter-description {
					display: block;
					color: var(--text-normal);
					font-size: 14px;
					line-height: 1.4;
					margin-top: 4px;
				}

				/* Error Messages */
				.infio-mcp-server-error-message {
					background-color: var(--background-modifier-error);
					border-left: 3px solid var(--text-error);
					padding: 12px;
					border-radius: var(--radius-s);
				}

				.infio-mcp-server-error-message pre {
					white-space: pre-wrap;
					word-break: break-all;
					margin-top: 8px;
					padding: 8px;
					background-color: var(--background-primary);
					border-radius: var(--radius-s);
					font-size: 12px;
				}

				.infio-mcp-item-timestamp {
					font-size: 12px;
					color: var(--text-faint);
					margin-top: 4px;
				}

				/* Empty State */
				.infio-mcp-hub-empty {
					text-align: center;
					padding: 40px 20px;
					color: var(--text-muted);
				}

				/* Create New Server Section */
				.infio-mcp-create-section {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					margin-bottom: 16px;
				}

				.infio-mcp-create-item {
					/* Remove background and padding since we're restructuring */
				}

				.infio-mcp-create-item-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 8px;
					cursor: pointer;
					transition: all 0.2s ease;
				}

				.infio-mcp-create-item-header:hover {
					background-color: var(--background-modifier-hover);
				}

				.infio-mcp-create-item-info {
					display: flex;
					align-items: center;
					gap: 12px;
					flex: 1;
				}

				.infio-mcp-create-title {
					margin: 0;
					font-size: 16px;
					font-weight: 600;
					color: var(--text-normal);
				}

				.infio-mcp-create-expanded {
					border-top: 1px solid var(--background-modifier-border);
					background-color: var(--background-secondary);
					padding: 16px;
					display: flex;
					flex-direction: column;
					gap: 12px;
					animation: expandContent 0.3s ease-out;
					border-bottom-left-radius: var(--radius-s);
					border-bottom-right-radius: var(--radius-s);
				}

				.infio-mcp-create-new {
					display: flex;
					flex-direction: column;
					gap: 12px;
				}

				.infio-mcp-create-label {
					font-size: 14px;
					font-weight: 500;
					color: var(--text-normal);
					margin-bottom: 4px;
				}

				.infio-mcp-create-input {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: 8px 12px;
					font-size: 14px;
					width: 100%;
					box-sizing: border-box;
					transition: border-color 0.2s ease;
				}

				.infio-mcp-create-input:focus {
					outline: none;
					border-color: var(--interactive-accent);
				}

				.infio-mcp-create-textarea {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					color: var(--text-normal);
					padding: 8px 12px;
					font-size: 14px;
					width: 100%;
					box-sizing: border-box;
					font-family: var(--font-monospace);
					resize: vertical;
					min-height: 140px;
					transition: border-color 0.2s ease;
				}

				.infio-mcp-create-textarea:focus {
					outline: none;
					border-color: var(--interactive-accent);
				}

				.infio-mcp-create-btn {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					border: none;
					border-radius: var(--radius-s);
					padding: 10px 16px;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s ease;
					align-self: flex-start;
				}

				.infio-mcp-create-btn:hover:not(:disabled) {
					background-color: var(--interactive-accent-hover);
					transform: translateY(-1px);
				}

				.infio-mcp-create-btn:disabled {
					opacity: 0.5;
					cursor: not-allowed;
					transform: none;
				}

				.infio-mcp-create-help {
					background-color: var(--background-modifier-form-field);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: 12px;
					margin: 8px 0;
					font-size: 13px;
					color: var(--text-muted);
				}

				.infio-mcp-create-help p {
					margin: 0 0 8px 0;
					font-weight: 500;
					color: var(--text-normal);
				}

				.infio-mcp-create-help ul {
					margin: 0;
					padding-left: 20px;
				}

				.infio-mcp-create-help li {
					margin-bottom: 4px;
					line-height: 1.4;
				}

				.infio-mcp-create-help code {
					background-color: var(--code-background);
					color: var(--code-normal);
					padding: 1px 4px;
					border-radius: 3px;
					font-family: var(--font-monospace);
					font-size: 12px;
				}



				/* Market Styles */
				.infio-mcp-market-list {
					display: flex;
					flex-direction: column;
					gap: 16px;
				}

				.infio-mcp-market-header-section {
					background-color: var(--background-secondary);
					border-radius: var(--radius-s);
					padding: 20px;
				}

				.infio-mcp-market-header-content {
					display: flex;
					justify-content: space-between;
					align-items: center;
					gap: 16px;
				}

				.infio-mcp-market-header-section h4 {
					margin: 0 0 8px 0;
					font-size: 18px;
					color: var(--text-normal);
				}

				.infio-mcp-market-header-section p {
					margin: 0;
					color: var(--text-muted);
					font-size: 14px;
				}

				.infio-mcp-market-empty {
					text-align: center;
					padding: 40px 20px;
					color: var(--text-muted);
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
				}

				.infio-mcp-error-action-button {
					margin-top: 12px;
				}

				.infio-mcp-retry-button {
					margin-top: 8px;
				}

				.infio-mcp-market-item {
					background-color: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					padding: 16px;
					transition: all 0.2s ease;
				}

				.infio-mcp-market-item:hover {
					border-color: var(--interactive-accent);
					box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
				}

				.infio-mcp-market-header {
					display: flex;
					justify-content: space-between;
					align-items: flex-start;
					margin-bottom: 12px;
				}

				.infio-mcp-market-info {
					flex: 1;
				}

				.infio-mcp-market-name {
					display: flex;
					align-items: center;
					gap: 8px;
					font-size: 16px;
					font-weight: 600;
					color: var(--text-normal);
					margin-bottom: 8px;
				}

				.infio-mcp-market-meta {
					display: flex;
					gap: 12px;
					font-size: 12px;
					color: var(--text-muted);
				}

				.infio-mcp-market-category {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					padding: 2px 8px;
					border-radius: var(--radius-s);
					font-weight: 500;
				}

				.infio-mcp-market-from {
					display: flex;
					align-items: center;
					gap: 4px;
					color: var(--text-accent);
					text-decoration: none;
					transition: all 0.2s ease;
				}

				.infio-mcp-market-from:hover {
					color: var(--text-normal);
					text-decoration: underline;
				}

				.infio-mcp-market-description {
					color: var(--text-muted);
					font-size: 14px;
					line-height: 1.4;
					margin-bottom: 16px;
				}

				.infio-mcp-market-tools h5 {
					margin: 0 0 8px 0;
					font-size: 14px;
					font-weight: 600;
					color: var(--text-normal);
				}

				.infio-mcp-market-tool {
					background-color: var(--background-secondary);
					border-radius: var(--radius-s);
					padding: 8px;
					margin-bottom: 8px;
				}

				.infio-mcp-market-tool code {
					background-color: var(--background-modifier-border);
					color: var(--text-accent);
					padding: 2px 6px;
					border-radius: 3px;
					font-family: var(--font-monospace);
					font-size: 12px;
					font-weight: 500;
					margin-right: 8px;
				}

				.infio-mcp-market-tool span {
					color: var(--text-normal);
					font-size: 14px;
				}

				.infio-mcp-market-tool-params {
					color: var(--text-muted);
					font-size: 12px;
					margin-top: 4px;
				}

				.infio-mcp-install-btn {
					background-color: var(--interactive-accent);
					color: var(--text-on-accent);
					border: none;
					border-radius: var(--radius-s);
					padding: 8px 12px;
					font-size: 14px;
					font-weight: 500;
					cursor: pointer;
					transition: all 0.2s ease;
					display: flex;
					align-items: center;
					gap: 4px;
				}

				.infio-mcp-install-btn:hover {
					background-color: var(--interactive-accent-hover);
					transform: translateY(-1px);
				}

				/* Servers List */
				.infio-mcp-hub-list {
					display: flex;
					flex-direction: column;
					gap: 0;
					margin-bottom: 20px;
				}
			`}</style>
		</div>
	)
}

export default McpHubView
