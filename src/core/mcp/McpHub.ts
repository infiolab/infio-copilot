// Obsidian
import { App, EventRef, Notice, TFile, normalizePath } from 'obsidian';

// Node built-in
import * as path from "path";

// SDK / External Libraries
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
	CallToolResultSchema,
	ListResourceTemplatesResultSchema,
	ListResourcesResultSchema,
	ListToolsResultSchema,
	ReadResourceResultSchema,
} from "@modelcontextprotocol/sdk/types.js";
import chokidar, { FSWatcher } from "chokidar"; // Keep chokidar
import delay from "delay"; // Keep delay
import deepEqual from "fast-deep-equal"; // Keep fast-deep-equal
import ReconnectingEventSource from "reconnecting-eventsource"; // Keep reconnecting-eventsource
import { EnvironmentVariables, shellEnvSync } from 'shell-env';
import { z } from "zod"; // Keep zod
// Internal/Project imports

import { INFIO_BASE_URL } from '../../constants'
import { t } from "../../lang/helpers";
import InfioPlugin from "../../main";
// Assuming path is correct and will be resolved, if not, this will remain an error.
// Users should verify this path if issues persist.
import { injectEnv } from "../../utils/config";

import {
	McpResource,
	McpResourceResponse,
	McpResourceTemplate,
	McpServer,
	McpTool,
	McpToolCallResponse,
} from "./type";


export type McpConnection = {
	server: McpServer
	client: Client
	transport: StdioClientTransport | SSEClientTransport
}

// 添加内置服务器连接类型
export type BuiltInMcpConnection = {
	server: McpServer
	// 内置服务器不需要 client 和 transport，直接通过 HTTP API 调用
}

export type AllMcpConnection = McpConnection | BuiltInMcpConnection

// Base configuration schema for common settings
const BaseConfigSchema = z.object({
	disabled: z.boolean().optional(),
	timeout: z.number().min(1).max(3600).optional().default(60),
	alwaysAllow: z.array(z.string()).default([]),
	watchPaths: z.array(z.string()).optional(), // paths to watch for changes and restart server
})

// Custom error messages for better user feedback
const typeErrorMessage = "Server type must be either 'stdio' or 'sse'"
const stdioFieldsErrorMessage =
	"For 'stdio' type servers, you must provide a 'command' field and can optionally include 'args' and 'env'"
const sseFieldsErrorMessage =
	"For 'sse' type servers, you must provide a 'url' field and can optionally include 'headers'"
const mixedFieldsErrorMessage =
	"Cannot mix 'stdio' and 'sse' fields. For 'stdio' use 'command', 'args', and 'env'. For 'sse' use 'url' and 'headers'"
const missingFieldsErrorMessage = "Server configuration must include either 'command' (for stdio) or 'url' (for sse)"

// Helper function to create a refined schema with better error messages
const createServerTypeSchema = () => {
	return z.union([
		// Stdio config (has command field)
		BaseConfigSchema.extend({
			type: z.enum(["stdio"]).optional(),
			command: z.string().min(1, "Command cannot be empty"),
			args: z.array(z.string()).optional(),
			// cwd: z.string().default(() => { // `this` is not available in this context
			// 	// TODO: Find a better way to set default CWD, perhaps during server initialization
			// 	// For now, let's make it optional or require it explicitly.
			// 	// const basePath = this.app?.vault?.adapter?.basePath; // this.app is not defined here
			// 	// return basePath || process.cwd();
			// }),
			cwd: z.string().optional(), // Made optional, to be handled during connection
			env: z.record(z.string()).optional(),
			// Ensure no SSE fields are present
			url: z.undefined().optional(),
			headers: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "stdio" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "stdio", { message: typeErrorMessage }),
		// SSE config (has url field)
		BaseConfigSchema.extend({
			type: z.enum(["sse"]).optional(),
			url: z.string().url("URL must be a valid URL format"),
			headers: z.record(z.string()).optional(),
			// Ensure no stdio fields are present
			command: z.undefined().optional(),
			args: z.undefined().optional(),
			env: z.undefined().optional(),
		})
			.transform((data) => ({
				...data,
				type: "sse" as const,
			}))
			.refine((data) => data.type === undefined || data.type === "sse", { message: typeErrorMessage }),
	])
}

// Server configuration schema with automatic type inference and validation
export const ServerConfigSchema = createServerTypeSchema()

// Settings schema
const McpSettingsSchema = z.object({
	mcpServers: z.record(ServerConfigSchema),
})

// 内置服务器工具的 API 响应类型
interface BuiltInToolResponse {
	name: string
	description?: string
	inputSchema?: object
	mcp_info?: {
		server_name: string
	}
}

export class McpHub {
	private app: App
	private plugin: InfioPlugin
	private mcpSettingsFilePath: string | null = null
	// private globalMcpFilePath: string | null = null
	private fileWatchers: Map<string, FSWatcher[]> = new Map()
	private isDisposed: boolean = false
	connections: McpConnection[] = []
	// 添加内置服务器连接
	builtInConnection: BuiltInMcpConnection | null = null
	isConnecting: boolean = false
	private refCount: number = 0 // Reference counter for active clients
	private eventRefs: EventRef[] = []; // For managing Obsidian event listeners
	// private providerRef: any; // TODO: Replace with actual type and initialize properly. Removed for now as it causes issues and its usage is unclear in the current scope.
	private shellEnv: EnvironmentVariables

	// 内置服务器配置
	private readonly BUILTIN_SERVER_NAME = "infio-builtin-server"

	constructor(app: App, plugin: InfioPlugin) {
		this.app = app
		this.plugin = plugin
		this.shellEnv = shellEnvSync()
		// Placeholder for providerRef initialization - this needs a proper solution if providerRef is essential.
		// if ((this.app as any).plugins?.plugins['obsidian-infio-copilot']) {
		// 	this.providerRef = (this.app as any).plugins.plugins['obsidian-infio-copilot'];
		// }
	}

	public async onload() {
		// Ensure the MCP configuration directory exists
		await this.ensureMcpFileExists()
		await this.watchMcpSettingsFile();
		// this.setupWorkspaceWatcher();
		await this.initializeGlobalMcpServers();
		// 初始化内置服务器
		await this.initializeBuiltInServer();
	}

	/**
	 * Registers a client (e.g., ClineProvider) using this hub.
	 * Increments the reference count.
	 */
	public registerClient(): void {
		this.refCount++
	}

	/**
	 * Unregisters a client. Decrements the reference count.
	 * If the count reaches zero, disposes the hub.
	 */
	public async unregisterClient(): Promise<void> {
		this.refCount--
		if (this.refCount <= 0) {
			await this.dispose()
		}
	}

	/**
	 * Validates and normalizes server configuration
	 * @param config The server configuration to validate
	 * @param serverName Optional server name for error messages
	 * @returns The validated configuration
	 * @throws Error if the configuration is invalid
	 */
	private validateServerConfig(config: unknown, serverName?: string): z.infer<typeof ServerConfigSchema> {
		if (typeof config !== 'object' || config === null) {
			throw new Error("Server configuration must be an object.");
		}

		// 使用类型保护而不是类型断言
		const configObj = config as Record<string, unknown>;

		// Detect configuration issues before validation
		const hasStdioFields = configObj.command !== undefined
		const hasSseFields = configObj.url !== undefined

		// Check for mixed fields
		if (hasStdioFields && hasSseFields) {
			throw new Error(mixedFieldsErrorMessage)
		}

		const mutableConfig = { ...configObj }; // Create a mutable copy

		// Check if it's a stdio or SSE config and add type if missing
		if (!mutableConfig.type) {
			if (hasStdioFields) {
				mutableConfig.type = "stdio"
			} else if (hasSseFields) {
				mutableConfig.type = "sse"
			} else {
				throw new Error(missingFieldsErrorMessage)
			}
		} else if (mutableConfig.type !== "stdio" && mutableConfig.type !== "sse") {
			throw new Error(typeErrorMessage)
		}

		// Check for type/field mismatch
		if (mutableConfig.type === "stdio" && !hasStdioFields) {
			throw new Error(stdioFieldsErrorMessage)
		}
		if (mutableConfig.type === "sse" && !hasSseFields) {
			throw new Error(sseFieldsErrorMessage)
		}

		// Validate the config against the schema
		try {
			return ServerConfigSchema.parse(mutableConfig) // Parse the mutable copy
		} catch (validationError) {
			if (validationError instanceof z.ZodError) {
				// Extract and format validation errors
				const errorMessages = validationError.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("; ")
				throw new Error(
					serverName
						? `Invalid configuration for server "${serverName}": ${errorMessages}`
						: `Invalid server configuration: ${errorMessages}`,
				)
			}
			throw validationError
		}
	}

	/**
	 * Formats and displays error messages to the user
	 * @param message The error message prefix
	 * @param error The error object
	 */
	private showErrorMessage(message: string, error: unknown): void {
		console.error(`${message}:`, error)
		new Notice(`${message}: ${error instanceof Error ? error.message : String(error)}`);
	}

	public setupWorkspaceWatcher(): void {
		this.eventRefs.push(this.app.vault.on('modify', async (file) => {
			// Adjusted to use the new config file name and path logic
			const configFilePath = await this.getMcpSettingsFilePath();
			if (file instanceof TFile && file.path === configFilePath) {
				await this.handleConfigFileChange(file.path);
			}
		}));
	}

	private async handleConfigFileChange(filePath: string): Promise<void> {
		try {
			const content = await this.app.vault.adapter.read(filePath);
			const config = JSON.parse(content)
			const result = McpSettingsSchema.safeParse(config)

			if (!result.success) {
				const errorMessages = result.error.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("\n")
				new Notice(String(t("common:errors.invalid_mcp_settings_validation")) + ": " + errorMessages)
				return
			}

			await this.updateServerConnections(result.data.mcpServers || {})
		} catch (error) {
			if (error instanceof SyntaxError) {
				new Notice(String(t("common:errors.invalid_mcp_settings_format")))
			} else {
				this.showErrorMessage(`Failed to process MCP settings change`, error)
			}
		}
	}

	// Removed watchProjectMcpFile, updateProjectMcpServers, cleanupProjectMcpServers, getProjectMcpPath, initializeProjectMcpServers
	// Removed getMcpServersPath as it's unused and problematic with providerRef

	getServers(): McpServer[] {
		// Only return enabled servers
		const standardServers = this.connections.filter((conn) => !conn.server.disabled).map((conn) => conn.server)

		// 添加内置服务器（如果存在且未禁用）
		if (this.builtInConnection && !this.builtInConnection.server.disabled) {
			return [this.builtInConnection.server, ...standardServers]
		}

		return standardServers
	}

	getAllServers(): McpServer[] {
		// Return all servers regardless of state
		const standardServers = this.connections.map((conn) => conn.server)

		// 添加内置服务器（如果存在）
		if (this.builtInConnection) {
			return [this.builtInConnection.server, ...standardServers]
		}

		return standardServers
	}

	async ensureMcpFileExists(): Promise<void> {
		const mcpFolderPath = ".infio_json_db/mcp"
		if (!await this.app.vault.adapter.exists(normalizePath(mcpFolderPath))) {
			await this.app.vault.createFolder(mcpFolderPath);
		}
		this.mcpSettingsFilePath = normalizePath(path.join(mcpFolderPath, "settings.json"))
		const fileExists = await this.app.vault.adapter.exists(this.mcpSettingsFilePath);
		if (!fileExists) {
			await this.app.vault.adapter.write(
				this.mcpSettingsFilePath,
				JSON.stringify({ mcpServers: {} }, null, 2)
			);
		}
		// this.globalMcpFilePath = normalizePath(path.join(mcpFolderPath, "global.json"))
		// const fileExists1 = await this.app.vault.adapter.exists(this.globalMcpFilePath);
		// if (!fileExists1) {
		// 	await this.app.vault.adapter.write(
		// 		this.globalMcpFilePath,
		// 		JSON.stringify({ mcpServers: {} }, null, 2)
		// 	);
		// }
	}

	async getMcpSettingsFilePath(): Promise<string> {
		return this.mcpSettingsFilePath
	}

	private async watchMcpSettingsFile(): Promise<void> {
		this.eventRefs.push(this.app.vault.on('modify', async (file) => {
			if (file.path === this.mcpSettingsFilePath) {
				await this.handleConfigFileChange(this.mcpSettingsFilePath)
			}
		}));
	}

	// Combined and simplified initializeMcpServers, only for global scope
	private async initializeGlobalMcpServers(): Promise<void> {
		try {
			if (!await this.app.vault.adapter.exists(this.mcpSettingsFilePath)) {
				// If config file doesn't exist after trying to create it in getMcpSettingsFilePath,
				// which should create it, then something is wrong.
				// However, getMcpSettingsFilePath should handle creation.
				// This check is more of a safeguard.
				// console.log("MCP config file does not exist, skipping initialization.");
				return;
			}

			const content = await this.app.vault.adapter.read(this.mcpSettingsFilePath);
			const config = JSON.parse(content);
			const result = McpSettingsSchema.safeParse(config);

			if (result.success) {
				await this.updateServerConnections(result.data.mcpServers || {});
			} else {
				const errorMessages = result.error.errors
					.map((err) => `${err.path.join(".")}: ${err.message}`)
					.join("\n");
				console.error(`Invalid MCP settings format:`, errorMessages);
				new Notice(String(t("common:errors.invalid_mcp_settings_validation")) + ": " + errorMessages);
				// Still try to connect with the raw config for global, but show warnings
				try {
					// 安全地处理未验证的配置
					const serversToConnect = config.mcpServers;
					if (serversToConnect && typeof serversToConnect === 'object') {
						await this.updateServerConnections(serversToConnect);
					} else {
						await this.updateServerConnections({});
					}
				} catch (error) {
					this.showErrorMessage(`Failed to initialize MCP servers with raw config`, error);
				}
			}
		} catch (error) {
			if (error instanceof SyntaxError) {
				const errorMessage = t("common:errors.invalid_mcp_settings_syntax");
				console.error(errorMessage, error);
				new Notice(String(errorMessage));
			} else {
				this.showErrorMessage(`Failed to initialize MCP servers`, error);
			}
		}
	}

	private async connectToServer(
		name: string,
		config: z.infer<typeof ServerConfigSchema>,
		source: "global" | "project" = "global"
	): Promise<void> {
		// Remove existing connection if it exists
		await this.deleteConnection(name)

		try {
			// Each MCP server requires its own transport connection and has unique capabilities, configurations, and error handling. Having separate clients also allows proper scoping                                  of resources/tools and independent server management like reconnection.
			const client = new Client(
				{
					name: "Roo Code",
					// version: this.providerRef?.deref ? (this.providerRef.deref()?.context?.extension?.packageJSON?.version ?? "1.0.0") : (this.providerRef?.context?.extension?.packageJSON?.version ?? "1.0.0"),
					// TODO: Get version properly if needed, e.g., from plugin manifest
					version: "1.0.0", // Placeholder
				},
				{
					capabilities: {},
				},
			)

			let transport: StdioClientTransport | SSEClientTransport

			// Inject environment variables to the config
			let configInjected = { ...config };
			try {
				// injectEnv might return a modified structure, so we re-validate.
				const tempConfigAfterInject = await injectEnv(config as Record<string, unknown>);
				const validatedInjectedConfig = ServerConfigSchema.safeParse(tempConfigAfterInject);
				if (validatedInjectedConfig.success) {
					configInjected = validatedInjectedConfig.data;
				} else {
					console.warn("Failed to validate server config after injecting env vars. Using original config.", validatedInjectedConfig.error);
					configInjected = config; // Fallback to original, already validated config
				}
			} catch (e) {
				console.warn("Error injecting env vars. Using original config.", e);
				configInjected = config; // Fallback to original config
			}

			if (configInjected.type === "stdio") {
				// Ensure cwd is set, default to plugin's root directory if not provided
				// Obsidian's DataAdapter doesn't have a direct `basePath`.
				// For a general plugin context, `this.app.vault.getRoot().path` gives the vault root.
				// If a path relative to the plugin is needed, it's more complex.
				// For stdio commands, often they are system-wide or expect to be run from a specific project dir.
				// Defaulting to "." (current working directory, typically the vault root when Obsidian runs it) is a safe bet if not specified.
				const cwd = configInjected.cwd || ".";

				transport = new StdioClientTransport({
					command: configInjected.command,
					args: configInjected.args,
					cwd: cwd,
					env: {
						...(configInjected.env || {}),
						...(this.shellEnv.PATH ? { PATH: this.shellEnv.PATH } : {}),
						...(this.shellEnv.HOME ? { HOME: this.shellEnv.HOME } : {}),
					},
					stderr: "pipe",
				})

				// Set up stdio specific error handling
				transport.onerror = async (error) => {
					console.error(`Transport error for "${name}":`, error)
					const connection = this.findConnection(name)
					if (connection) {
						connection.server.status = "disconnected"
						this.appendErrorMessage(connection, error instanceof Error ? error.message : String(error))
					}
					// await this.notifyWebviewOfServerChanges()
				}

				transport.onclose = async () => {
					const connection = this.findConnection(name)
					if (connection) {
						connection.server.status = "disconnected"
					}
					// await this.notifyWebviewOfServerChanges()
				}

				// transport.stderr is only available after the process has been started. However we can't start it separately from the .connect() call because it also starts the transport. And we can't place this after the connect call since we need to capture the stderr stream before the connection is established, in order to capture errors during the connection process.
				// As a workaround, we start the transport ourselves, and then monkey-patch the start method to no-op so that .connect() doesn't try to start it again.
				await transport.start()
				const stderrStream = transport.stderr
				if (stderrStream) {
					stderrStream.on("data", async (data: Buffer) => {
						const output = data.toString()
						// Check if output contains INFO level log
						const isInfoLog = /INFO/i.test(output)

						if (isInfoLog) {
							// Log normal informational messages
							console.log(`Server "${name}" info:`, output)
						} else {
							// Treat as error log
							console.error(`Server "${name}" stderr:`, output)
							const connection = this.findConnection(name)
							if (connection) {
								this.appendErrorMessage(connection, output)
								if (connection.server.status === "disconnected") {
									// await this.notifyWebviewOfServerChanges()
								}
							}
						}
					})
				} else {
					console.error(`No stderr stream for ${name}`)
				}
				transport.start = async () => { } // No-op now, .connect() won't fail
			} else {
				// SSE connection
				const sseOptions = {
					requestInit: {
						headers: configInjected.headers,
					},
				}
				// Configure ReconnectingEventSource options
				const reconnectingEventSourceOptions = {
					max_retry_time: 5000, // Maximum retry time in milliseconds
					withCredentials: configInjected.headers?.["Authorization"] ? true : false, // Enable credentials if Authorization header exists
				}
				global.EventSource = ReconnectingEventSource
				transport = new SSEClientTransport(new URL(configInjected.url), {
					...sseOptions,
					eventSourceInit: reconnectingEventSourceOptions,
				})

				// Set up SSE specific error handling
				transport.onerror = async (error) => {
					console.error(`Transport error for "${name}":`, error)
					const connection = this.findConnection(name, source)
					if (connection) {
						connection.server.status = "disconnected"
						this.appendErrorMessage(connection, error instanceof Error ? error.message : String(error))
					}
					// await this.notifyWebviewOfServerChanges()
				}
			}

			const connection: McpConnection = {
				server: {
					name,
					config: JSON.stringify(configInjected),
					status: "connecting",
					disabled: configInjected.disabled,
					source,
					projectPath: source === "project" ? this.app.vault.getRoot().path : undefined,
					errorHistory: [],
				},
				client,
				transport,
			}
			this.connections.push(connection)

			// Connect (this will automatically start the transport)
			await client.connect(transport)
			connection.server.status = "connected"
			connection.server.error = ""

			// Initial fetch of tools and resources
			connection.server.tools = await this.fetchToolsList(name, source)
			connection.server.resources = await this.fetchResourcesList(name, source)
			connection.server.resourceTemplates = await this.fetchResourceTemplatesList(name, source)
		} catch (error) {
			// Update status with error
			const connection = this.findConnection(name, source)
			if (connection) {
				connection.server.status = "disconnected"
				this.appendErrorMessage(connection, error instanceof Error ? error.message : `${error}`)
			}
			throw error
		}
	}

	private appendErrorMessage(connection: McpConnection, error: string, level: "error" | "warn" | "info" = "error") {
		const MAX_ERROR_LENGTH = 1000
		const truncatedError =
			error.length > MAX_ERROR_LENGTH
				? `${error.substring(0, MAX_ERROR_LENGTH)}...(error message truncated)`
				: error

		// Add to error history
		if (!connection.server.errorHistory) {
			connection.server.errorHistory = []
		}

		connection.server.errorHistory.push({
			message: truncatedError,
			timestamp: Date.now(),
			level,
		})

		// Keep only the last 100 errors
		if (connection.server.errorHistory.length > 100) {
			connection.server.errorHistory = connection.server.errorHistory.slice(-100)
		}

		// Update current error display
		connection.server.error = truncatedError
	}

	/**
	 * Helper method to find a connection by server name and source
	 * @param serverName The name of the server to find
	 * @param source Optional source to filter by (global or project)
	 * @returns The matching connection or undefined if not found
	 */
	private findConnection(serverName: string, source: "global" | "project" = "global"): McpConnection | undefined {
		// If source is specified, only find servers with that source
		if (source !== undefined) {
			return this.connections.find((conn) => conn.server.name === serverName && conn.server.source === source)
		}

		// If no source is specified, first look for project servers, then global servers
		// This ensures that when servers have the same name, project servers are prioritized
		const projectConn = this.connections.find(
			(conn) => conn.server.name === serverName && conn.server.source === "project",
		)
		if (projectConn) return projectConn

		// If no project server is found, look for global servers
		return this.connections.find(
			(conn) => conn.server.name === serverName && (conn.server.source === "global" || !conn.server.source),
		)
	}

	private async fetchToolsList(serverName: string, source: "global" | "project" = "global"): Promise<McpTool[]> {
		try {
			// Use the helper method to find the connection
			const connection = this.findConnection(serverName, source)

			if (!connection) {
				throw new Error(`Server ${serverName} not found`)
			}

			const response = await connection.client.request({ method: "tools/list" }, ListToolsResultSchema)

			// Determine the actual source of the server
			const actualSource = connection.server.source || "global"
			let configPath: string
			let alwaysAllowConfig: string[] = []

			// Read from the appropriate config file based on the actual source
			try {
				if (actualSource === "project") {
					// Get project MCP config path
					const projectMcpPath = normalizePath(".infio_json_db/mcp/mcp.json")
					if (await this.app.vault.adapter.exists(projectMcpPath)) {
						configPath = projectMcpPath
						const content = await this.app.vault.adapter.read(configPath)
						const config = JSON.parse(content)
						alwaysAllowConfig = config.mcpServers?.[serverName]?.alwaysAllow || []
					}
				} else {
					// Get global MCP settings path
					configPath = normalizePath(".infio_json_db/mcp/settings.json")
					const content = await this.app.vault.adapter.read(configPath)
					const config = JSON.parse(content)
					alwaysAllowConfig = config.mcpServers?.[serverName]?.alwaysAllow || []
				}
			} catch (error) {
				console.error(`Failed to read alwaysAllow config for ${serverName}:`, error)
				// Continue with empty alwaysAllowConfig
			}

			// Mark tools as always allowed based on settings
			const tools = (response?.tools || []).map((tool) => ({
				...tool,
				alwaysAllow: alwaysAllowConfig.includes(tool.name),
			}))

			// @ts-expect-error - 服务器返回的工具对象中 name 是可选的，但 McpTool 类型要求它是必需的
			return tools
		} catch (error) {
			console.error(`Failed to fetch tools for ${serverName}:`, error)
			return []
		}
	}

	private async fetchResourcesList(serverName: string, source?: "global" | "project"): Promise<McpResource[]> {
		try {
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				return []
			}
			const response = await connection.client.request({ method: "resources/list" }, ListResourcesResultSchema)
			// @ts-expect-error - 服务器返回的资源对象中 name 是可选的，但 McpResource 类型要求它是必需的
			return response?.resources || []
		} catch (error) {
			// console.error(`Failed to fetch resources for ${serverName}:`, error)
			return []
		}
	}

	private async fetchResourceTemplatesList(
		serverName: string,
		source: "global" | "project" = "global",
	): Promise<McpResourceTemplate[]> {
		try {
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				return []
			}
			const response = await connection.client.request(
				{ method: "resources/templates/list" },
				ListResourceTemplatesResultSchema,
			)
			// @ts-expect-error - 服务器返回的资源模板对象中 name 是可选的，但 McpResourceTemplate 类型要求它是必需的
			return response?.resourceTemplates || []
		} catch (error) {
			// console.error(`Failed to fetch resource templates for ${serverName}:`, error)
			return []
		}
	}

	async deleteConnection(name: string, source: "global" | "project" = "global"): Promise<void> {
		// If source is provided, only delete connections from that source
		const connections = source
			? this.connections.filter((conn) => conn.server.name === name && conn.server.source === source)
			: this.connections.filter((conn) => conn.server.name === name)

		for (const connection of connections) {
			try {
				await connection.transport.close()
				await connection.client.close()
			} catch (error) {
				console.error(`Failed to close transport for ${name}:`, error)
			}
			this.connections = this.connections.filter((conn) => conn.server.name !== name)
		}

		// Remove the connections from the array
		this.connections = this.connections.filter((conn) => {
			if (conn.server.name !== name) return true
			if (source && conn.server.source !== source) return true
			return false
		})
	}

	async updateServerConnections(
		newServers: Record<string, unknown>,
		source: "global" | "project" = "global",
	): Promise<void> {
		this.isConnecting = true
		this.removeAllFileWatchers()
		// Filter connections by source
		const currentConnections = this.connections.filter(
			(conn) => conn.server.source === source || (!conn.server.source && source === "global"),
		)
		const currentNames = new Set(currentConnections.map((conn) => conn.server.name))
		const newNames = new Set(Object.keys(newServers))

		// Delete removed servers
		for (const name of currentNames) {
			if (!newNames.has(name)) {
				await this.deleteConnection(name, source)
			}
		}

		// Update or add servers·
		for (const [name, config] of Object.entries(newServers)) {
			// Only consider connections that match the current source
			const currentConnection = this.findConnection(name, source)

			// Validate and transform the config
			let validatedConfig: z.infer<typeof ServerConfigSchema>
			try {
				validatedConfig = this.validateServerConfig(config, name)
			} catch (error) {
				this.showErrorMessage(`Invalid configuration for MCP server "${name}"`, error)
				continue
			}

			if (!currentConnection) {
				// New server
				try {
					this.setupFileWatcher(name, validatedConfig, source)
					await this.connectToServer(name, validatedConfig, source)
				} catch (error) {
					this.showErrorMessage(`Failed to connect to new MCP server ${name}`, error)
				}
			} else if (!deepEqual(JSON.parse(currentConnection.server.config), config)) {
				// Existing server with changed config
				try {
					this.setupFileWatcher(name, validatedConfig, source)
					await this.deleteConnection(name, source)
					await this.connectToServer(name, validatedConfig, source)
				} catch (error) {
					this.showErrorMessage(`Failed to reconnect MCP server ${name}`, error)
				}
			}
			// If server exists with same config, do nothing
		}
		// await this.notifyWebviewOfServerChanges()
		this.isConnecting = false
	}

	private setupFileWatcher(
		name: string,
		config: z.infer<typeof ServerConfigSchema>,
		source: "global" | "project" = "global",
	) {
		// Initialize an empty array for this server if it doesn't exist
		if (!this.fileWatchers.has(name)) {
			this.fileWatchers.set(name, [])
		}

		const watchers = this.fileWatchers.get(name) || []

		// Only stdio type has args
		if (config.type === "stdio") {
			// Setup watchers for custom watchPaths if defined
			if (config.watchPaths && config.watchPaths.length > 0) {
				const watchPathsWatcher = chokidar.watch(config.watchPaths, {
					// persistent: true,
					// ignoreInitial: true,
					// awaitWriteFinish: true,
				})

				watchPathsWatcher.on("change", async (changedPath) => {
					try {
						// Pass the source from the config to restartConnection
						await this.restartConnection(name, source)
					} catch (error) {
						console.error(`Failed to restart server ${name} after change in ${changedPath}:`, error)
					}
				})

				watchers.push(watchPathsWatcher)
			}

			// Also setup the fallback build/index.js watcher if applicable
			const filePath = config.args?.find((arg: string) => arg.includes("build/index.js"))
			if (filePath) {
				// we use chokidar instead of onDidSaveTextDocument because it doesn't require the file to be open in the editor
				const indexJsWatcher = chokidar.watch(filePath, {
					// persistent: true,
					// ignoreInitial: true,
					// awaitWriteFinish: true, // This helps with atomic writes
				})

				indexJsWatcher.on("change", async () => {
					try {
						// Pass the source from the config to restartConnection
						await this.restartConnection(name, source)
					} catch (error) {
						console.error(`Failed to restart server ${name} after change in ${filePath}:`, error)
					}
				})

				watchers.push(indexJsWatcher)
			}

			// Update the fileWatchers map with all watchers for this server
			if (watchers.length > 0) {
				this.fileWatchers.set(name, watchers)
			}
		}
	}

	private removeAllFileWatchers() {
		this.fileWatchers.forEach((watchers) => watchers.forEach((watcher) => watcher.close()))
		this.fileWatchers.clear()
	}

	async restartConnection(serverName: string, source?: "global" | "project"): Promise<void> {
		this.isConnecting = true
		// const provider = this.providerRef.deref()
		// if (!provider) {
		// 	return
		// }

		// Get existing connection and update its status
		const connection = this.findConnection(serverName, source)
		const config = connection?.server.config
		if (config) {
			// vscode.window.showInformationMessage(t("common:info.mcp_server_restarting", { serverName }))
			connection.server.status = "connecting"
			connection.server.error = ""
			// await this.notifyWebviewOfServerChanges()
			await delay(500) // artificial delay to show user that server is restarting
			try {
				await this.deleteConnection(serverName, connection.server.source)
				// Parse the config to validate it
				const parsedConfig = JSON.parse(config)
				try {
					// Validate the config
					const validatedConfig = this.validateServerConfig(parsedConfig, serverName)

					// Try to connect again using validated config
					await this.connectToServer(serverName, validatedConfig)
					// vscode.window.showInformationMessage(t("common:info.mcp_server_connected", { serverName }))
				} catch (validationError) {
					this.showErrorMessage(`Invalid configuration for MCP server "${serverName}"`, validationError)
				}
			} catch (error) {
				this.showErrorMessage(`Failed to restart ${serverName} MCP server connection`, error)
			}
		}

		// await this.notifyWebviewOfServerChanges()
		this.isConnecting = false
	}

	// private async notifyWebviewOfServerChanges(): Promise<void> {
	// 	// Get global server order from settings file
	// 	const settingsPath = await this.getMcpSettingsFilePath()
	// 	const content = await fs.readFile(settingsPath, "utf-8")
	// 	const config = JSON.parse(content)
	// 	const globalServerOrder = Object.keys(config.mcpServers || {})

	// 	// Get project server order if available
	// 	const projectMcpPath = await this.getProjectMcpPath()
	// 	let projectServerOrder: string[] = []
	// 	if (projectMcpPath) {
	// 		try {
	// 			const projectContent = await fs.readFile(projectMcpPath, "utf-8")
	// 			const projectConfig = JSON.parse(projectContent)
	// 			projectServerOrder = Object.keys(projectConfig.mcpServers || {})
	// 		} catch (error) {
	// 			// Silently continue with empty project server order
	// 		}
	// 	}

	// 	// Sort connections: first project servers in their defined order, then global servers in their defined order
	// 	// This ensures that when servers have the same name, project servers are prioritized
	// 	const sortedConnections = [...this.connections].sort((a, b) => {
	// 		const aIsGlobal = a.server.source === "global" || !a.server.source
	// 		const bIsGlobal = b.server.source === "global" || !b.server.source

	// 		// If both are global or both are project, sort by their respective order
	// 		if (aIsGlobal && bIsGlobal) {
	// 			const indexA = globalServerOrder.indexOf(a.server.name)
	// 			const indexB = globalServerOrder.indexOf(b.server.name)
	// 			return indexA - indexB
	// 		} else if (!aIsGlobal && !bIsGlobal) {
	// 			const indexA = projectServerOrder.indexOf(a.server.name)
	// 			const indexB = projectServerOrder.indexOf(b.server.name)
	// 			return indexA - indexB
	// 		}

	// 		// Project servers come before global servers (reversed from original)
	// 		return aIsGlobal ? 1 : -1
	// 	})

	// 	// Send sorted servers to webview
	// 	await this.providerRef.deref()?.postMessageToWebview({
	// 		type: "mcpServers",
	// 		mcpServers: sortedConnections.map((connection) => connection.server),
	// 	})
	// }

	public async toggleServerDisabled(
		serverName: string,
		disabled: boolean,
		source: "global" | "project" = "global",
	): Promise<void> {
		try {
			// 检查是否为内置服务器
			if (serverName === this.BUILTIN_SERVER_NAME) {
				if (this.builtInConnection) {
					this.builtInConnection.server.disabled = disabled
					console.log(`Built-in server ${disabled ? 'disabled' : 'enabled'}`)
				}
				return
			}

			// Find the connection to determine if it's a global or project server
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
			}

			const serverSource = connection.server.source
			// Update the server config in the appropriate file
			await this.updateServerConfig(serverName, { disabled }, serverSource)

			// Update the connection object
			if (connection) {
				try {
					connection.server.disabled = disabled

					// Only refresh capabilities if connected
					if (connection.server.status === "connected") {
						connection.server.tools = await this.fetchToolsList(serverName, serverSource)
						connection.server.resources = await this.fetchResourcesList(serverName, serverSource)
						connection.server.resourceTemplates = await this.fetchResourceTemplatesList(
							serverName,
							serverSource,
						)
					}
				} catch (error) {
					console.error(`Failed to refresh capabilities for ${serverName}:`, error)
				}
			}
		} catch (error) {
			this.showErrorMessage(`Failed to update server ${serverName} state`, error)
			throw error
		}
	}

	/**
	 * Helper method to update a server's configuration in the appropriate settings file
	 * @param serverName The name of the server to update
	 * @param configUpdate The configuration updates to apply
	 * @param source Whether to update the global or project config
	 */
	private async updateServerConfig(
		serverName: string,
		configUpdate: Record<string, unknown>,
		source: "global" | "project" = "global",
	): Promise<void> {
		// Determine which config file to update
		let configPath: string
		if (source === "project") {
			const projectMcpPath = normalizePath(".infio_json_db/mcp/mcp.json")
			if (!await this.app.vault.adapter.exists(projectMcpPath)) {
				throw new Error("Project MCP configuration file not found")
			}
			configPath = projectMcpPath
		} else {
			configPath = await this.getMcpSettingsFilePath()
		}

		// Read and parse the config file
		const content = await this.app.vault.adapter.read(configPath)
		const config = JSON.parse(content)

		// Validate the config structure
		if (!config || typeof config !== "object") {
			throw new Error("Invalid config structure")
		}

		if (!config.mcpServers || typeof config.mcpServers !== "object") {
			config.mcpServers = {}
		}

		if (!config.mcpServers[serverName]) {
			config.mcpServers[serverName] = {}
		}

		// Create a new server config object to ensure clean structure
		const serverConfig = {
			...config.mcpServers[serverName],
			...configUpdate,
		}

		// Ensure required fields exist
		if (!serverConfig.alwaysAllow) {
			serverConfig.alwaysAllow = []
		}

		config.mcpServers[serverName] = serverConfig

		// Write the entire config back
		const updatedConfig = {
			mcpServers: config.mcpServers,
		}

		await this.app.vault.adapter.write(configPath, JSON.stringify(updatedConfig, null, 2))
	}

	public async updateServerTimeout(
		serverName: string,
		timeout: number,
		source: "global" | "project" = "global",
	): Promise<void> {
		try {
			// Find the connection to determine if it's a global or project server
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
			}

			// Update the server config in the appropriate file
			await this.updateServerConfig(serverName, { timeout }, connection.server.source || "global")

			// await this.notifyWebviewOfServerChanges()
		} catch (error) {
			this.showErrorMessage(`Failed to update server ${serverName} timeout settings`, error)
			throw error
		}
	}

	public async deleteServer(serverName: string, source?: "global" | "project"): Promise<void> {
		try {
			// Find the connection to determine if it's a global or project server
			const connection = this.findConnection(serverName, source)
			if (!connection) {
				throw new Error(`Server ${serverName}${source ? ` with source ${source}` : ""} not found`)
			}

			const serverSource = connection.server.source || "global"
			// Determine config file based on server source
			const isProjectServer = serverSource === "project"
			let configPath: string

			if (isProjectServer) {
				// Get project MCP config path
				const projectMcpPath = normalizePath(".infio_json_db/mcp/mcp.json")
				if (!await this.app.vault.adapter.exists(projectMcpPath)) {
					throw new Error("Project MCP configuration file not found")
				}
				configPath = projectMcpPath
			} else {
				// Get global MCP settings path
				configPath = await this.getMcpSettingsFilePath()
			}

			const content = await this.app.vault.adapter.read(configPath)
			const config = JSON.parse(content)

			// Validate the config structure
			if (!config || typeof config !== "object") {
				throw new Error("Invalid config structure")
			}

			if (!config.mcpServers || typeof config.mcpServers !== "object") {
				config.mcpServers = {}
			}

			// Remove the server from the settings
			if (config.mcpServers[serverName]) {
				// 使用 Reflect.deleteProperty 而不是 delete 操作符
				Reflect.deleteProperty(config.mcpServers, serverName)

				// Write the entire config back
				const updatedConfig = {
					mcpServers: config.mcpServers,
				}

				await this.app.vault.adapter.write(configPath, JSON.stringify(updatedConfig, null, 2))

				// Update server connections with the correct source
				await this.updateServerConnections(config.mcpServers, serverSource)

				// vscode.window.showInformationMessage(t("common:info.mcp_server_deleted", { serverName }))
			} else {
				// vscode.window.showWarningMessage(t("common:info.mcp_server_not_found", { serverName }))
			}
		} catch (error) {
			this.showErrorMessage(`Failed to delete MCP server ${serverName}`, error)
			throw error
		}
	}

	/**
	 * Creates a new MCP server with the given name and configuration
	 * @param name The name of the server to create
	 * @param config JSON string containing the server configuration
	 * @param source Whether to create in global or project scope (defaults to global)
	 */
	public async createServer(
		name: string,
		config: string,
		source: "global" | "project" = "global"
	): Promise<void> {
		try {
			// Parse the JSON config string
			let parsedConfig: unknown
			try {
				parsedConfig = JSON.parse(config)
			} catch (error) {
				throw new Error(`Invalid JSON format in config: ${error instanceof Error ? error.message : String(error)}`)
			}

			// Validate the parsed config
			const validatedConfig = this.validateServerConfig(parsedConfig, name)

			// Determine which config file to update
			let configPath: string
			if (source === "project") {
				const projectMcpPath = normalizePath(".infio_json_db/mcp/mcp.json")
				if (!await this.app.vault.adapter.exists(projectMcpPath)) {
					// Create project config file if it doesn't exist
					await this.app.vault.adapter.write(
						projectMcpPath,
						JSON.stringify({ mcpServers: {} }, null, 2)
					)
				}
				configPath = projectMcpPath
			} else {
				configPath = await this.getMcpSettingsFilePath()
			}

			// Read current config
			const content = await this.app.vault.adapter.read(configPath)
			const currentConfig = JSON.parse(content)

			// Validate the config structure
			if (!currentConfig || typeof currentConfig !== "object") {
				throw new Error("Invalid config file structure")
			}

			// Ensure mcpServers object exists
			if (!currentConfig.mcpServers || typeof currentConfig.mcpServers !== "object") {
				currentConfig.mcpServers = {}
			}

			// Check if server already exists
			if (currentConfig.mcpServers[name]) {
				throw new Error(`Server "${name}" already exists. Use updateServerConfig to modify existing servers.`)
			}

			// Add the new server to the config
			currentConfig.mcpServers[name] = validatedConfig

			// Write the updated config back to file
			const updatedConfig = {
				mcpServers: currentConfig.mcpServers,
			}

			await this.app.vault.adapter.write(configPath, JSON.stringify(updatedConfig, null, 2))

			// Update server connections to connect to the new server
			await this.updateServerConnections(currentConfig.mcpServers, source)

			console.log(`Successfully created and connected to MCP server: ${name}`)
		} catch (error) {
			this.showErrorMessage(`Failed to create MCP server "${name}"`, error)
			throw error
		}
	}

	async readResource(serverName: string, uri: string, source: "global" | "project" = "global"): Promise<McpResourceResponse> {
		const connection = this.findConnection(serverName, source)
		if (!connection) {
			throw new Error(`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}`)
		}
		if (connection.server.disabled) {
			throw new Error(`Server "${serverName}" is disabled`)
		}
		// @ts-expect-error - 服务器返回的资源对象中 name 是可选的，但 McpResourceResponse 类型要求它是必需的
		return await connection.client.request(
			{
				method: "resources/read",
				params: {
					uri,
				},
			},
			ReadResourceResultSchema,
		)
	}

	async callTool(
		serverName: string,
		toolName: string,
		toolArguments?: Record<string, unknown>,
		source: "global" | "project" = "global",
	): Promise<McpToolCallResponse> {
		// 检查是否为内置服务器
		if (serverName === this.BUILTIN_SERVER_NAME) {
			return await this.callBuiltInTool(toolName, toolArguments)
		}

		const connection = this.findConnection(serverName, source)
		if (!connection) {
			throw new Error(
				`No connection found for server: ${serverName}${source ? ` with source ${source}` : ""}. Please make sure to use MCP servers available under 'Connected MCP Servers'.`,
			)
		}
		if (connection.server.disabled) {
			throw new Error(`Server "${serverName}" is disabled and cannot be used`)
		}

		let timeout: number
		try {
			const parsedConfig = ServerConfigSchema.parse(JSON.parse(connection.server.config))
			timeout = (parsedConfig.timeout ?? 60) * 1000
		} catch (error) {
			console.error("Failed to parse server config for timeout:", error)
			// Default to 60 seconds if parsing fails
			timeout = 60 * 1000
		}

		// @ts-expect-error - 服务器返回的工具调用对象中 name 是可选的，但 McpToolCallResponse 类型要求它是必需的
		return await connection.client.request(
			{
				method: "tools/call",
				params: {
					name: toolName,
					arguments: toolArguments,
				},
			},
			CallToolResultSchema,
			{
				timeout,
			},
		)
	}

	// 调用内置服务器工具
	private async callBuiltInTool(
		toolName: string,
		toolArguments?: Record<string, unknown>
	): Promise<McpToolCallResponse> {
		try {
			if (!this.builtInConnection) {
				throw new Error("Built-in server is not initialized")
			}

			if (this.builtInConnection.server.disabled) {
				throw new Error("Built-in server is disabled and cannot be used")
			}

			if (this.builtInConnection.server.status !== "connected") {
				throw new Error("Built-in server is not connected")
			}

			// 调用内置 API，设置 10 分钟超时
			const controller = new AbortController()
			const timeoutId = setTimeout(() => {
				controller.abort()
			}, 10 * 60 * 1000) // 10 分钟超时

			try {
				const response = await fetch(`${INFIO_BASE_URL}/mcp/tools/call`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'Authorization': `Bearer ${this.plugin.settings.infioProvider.apiKey}`,
					},
					body: JSON.stringify({
						name: toolName,
						arguments: toolArguments || {},
					}),
					signal: controller.signal,
				})

				clearTimeout(timeoutId)

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`)
				}

				const result = await response.json()

				// 接口已经返回了 MCP 格式的内容数组，直接使用
				return {
					content: Array.isArray(result) ? result : [result],
					isError: false,
				}
			} catch (error) {
				clearTimeout(timeoutId)
				console.error(`Failed to call built-in tool ${toolName}:`, error)
				// 特殊处理超时错误
				let errorMessage: string
				if (error instanceof Error && error.name === 'AbortError') {
					errorMessage = `请求超时：工具 ${toolName} 执行时间超过 10 分钟`
				} else {
					errorMessage = `Error calling built-in tool: ${error instanceof Error ? error.message : String(error)}`
				}

				return {
					content: [{
						type: "text",
						text: errorMessage
					}],
					isError: true,
				}
			}
		} catch (error) {
			console.error(`Failed to call built-in tool ${toolName}:`, error)
			throw error
		}
	}

	async toggleToolAlwaysAllow(
		serverName: string,
		source: "global" | "project" = "global",
		toolName: string,
		shouldAllow: boolean,
	): Promise<void> {
		try {
			// 检查是否为内置服务器
			if (serverName === this.BUILTIN_SERVER_NAME) {
				if (this.builtInConnection) {
					// 更新内置服务器工具的 alwaysAllow 状态
					const tool = this.builtInConnection.server.tools?.find(t => t.name === toolName)
					if (tool) {
						tool.alwaysAllow = shouldAllow
						console.log(`Built-in tool ${toolName} ${shouldAllow ? 'always allowed' : 'permission required'}`)
					}
				}
				return
			}

			// Find the connection with matching name and source
			const connection = this.findConnection(serverName, source)

			if (!connection) {
				throw new Error(`Server ${serverName} with source ${source} not found`)
			}

			// Determine the correct config path based on the source
			let configPath: string
			if (source === "project") {
				// Get project MCP config path
				const projectMcpPath = normalizePath(".infio_json_db/mcp/mcp.json")
				if (!await this.app.vault.adapter.exists(projectMcpPath)) {
					throw new Error("Project MCP configuration file not found")
				}
				configPath = projectMcpPath
			} else {
				// Get global MCP settings path
				configPath = await this.getMcpSettingsFilePath()
			}

			// Normalize path for cross-platform compatibility
			// Use a consistent path format for both reading and writing
			// const normalizedPath = configPath

			// Read the appropriate config file
			const content = await this.app.vault.adapter.read(configPath)
			const config = JSON.parse(content)

			// Initialize mcpServers if it doesn't exist
			if (!config.mcpServers) {
				config.mcpServers = {}
			}

			// Initialize server config if it doesn't exist
			if (!config.mcpServers[serverName]) {
				config.mcpServers[serverName] = {
					type: "stdio",
					command: "node",
					args: [], // Default to an empty array; can be set later if needed
				}
			}

			// Initialize alwaysAllow if it doesn't exist
			if (!config.mcpServers[serverName].alwaysAllow) {
				config.mcpServers[serverName].alwaysAllow = []
			}

			const alwaysAllow = config.mcpServers[serverName].alwaysAllow
			const toolIndex = alwaysAllow.indexOf(toolName)

			if (shouldAllow && toolIndex === -1) {
				// Add tool to always allow list
				alwaysAllow.push(toolName)
			} else if (!shouldAllow && toolIndex !== -1) {
				// Remove tool from always allow list
				alwaysAllow.splice(toolIndex, 1)
			}

			// Write updated config back to file
			await this.app.vault.adapter.write(configPath, JSON.stringify(config, null, 2))

			// Update the tools list to reflect the change
			if (connection) {
				// Explicitly pass the source to ensure we're updating the correct server's tools
				connection.server.tools = await this.fetchToolsList(serverName, source)
				// await this.notifyWebviewOfServerChanges()
			}
		} catch (error) {
			this.showErrorMessage(`Failed to update always allow settings for tool ${toolName}`, error)
			throw error // Re-throw to ensure the error is properly handled
		}
	}

	async dispose(): Promise<void> {
		// Prevent multiple disposals
		if (this.isDisposed) {
			console.log("McpHub: Already disposed.")
			return
		}
		console.log("McpHub: Disposing...")
		this.isDisposed = true
		this.removeAllFileWatchers()
		for (const connection of this.connections) {
			try {
				await this.deleteConnection(connection.server.name, connection.server.source)
			} catch (error) {
				console.error(`Failed to close connection for ${connection.server.name}:`, error)
			}
		}
		this.connections = []

		// 清理内置服务器连接
		this.builtInConnection = null

		this.eventRefs.forEach((ref) => this.app.vault.offref(ref))
		this.eventRefs = []
	}

	// 初始化内置服务器
	private async initializeBuiltInServer(): Promise<void> {
		try {
			console.log("Initializing built-in server...")

			// 获取工具列表
			const tools = await this.fetchBuiltInTools()

			// 创建内置服务器连接
			this.builtInConnection = {
				server: {
					name: this.BUILTIN_SERVER_NAME,
					config: JSON.stringify({ type: "builtin" }),
					status: "connected",
					disabled: false,
					source: "global",
					tools: tools,
					resources: [], // 内置服务器暂不支持资源
					resourceTemplates: [], // 内置服务器暂不支持资源模板
				}
			}

			console.log(`Built-in server initialized with ${tools.length} tools`)
		} catch (error) {
			console.error("Failed to initialize built-in server:", error)
			this.builtInConnection = {
				server: {
					name: this.BUILTIN_SERVER_NAME,
					config: JSON.stringify({ type: "builtin" }),
					status: "disconnected",
					disabled: false,
					source: "global",
					error: error instanceof Error ? error.message : String(error),
					tools: [],
					resources: [],
					resourceTemplates: [],
				}
			}
		}
	}

	// 从内置 API 获取工具列表
	private async fetchBuiltInTools(): Promise<McpTool[]> {
		try {
			const response = await fetch(`${INFIO_BASE_URL}/mcp/tools/list`, {
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.plugin.settings.infioProvider.apiKey}`,
				},
			})
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`)
			}

			const tools: BuiltInToolResponse[] = await response.json()

			// 转换为 McpTool 格式
			return tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema,
				alwaysAllow: false, // 默认不自动允许
			}))
		} catch (error) {
			console.error("Failed to fetch built-in tools:", error)
			throw error
		}
	}

	/**
	 * 检查内置服务器是否可用
	 * @returns true 如果内置服务器已连接且未被禁用，否则返回 false
	 */
	public isBuiltInServerAvailable(): boolean {
		return !!(
			this.builtInConnection &&
			this.builtInConnection.server.status === "connected" &&
			!this.builtInConnection.server.disabled
		)
	}

	/**
	 * 获取内置服务器的详细状态信息
	 * @returns 包含内置服务器状态信息的对象，如果不存在则返回 null
	 */
	public getBuiltInServerStatus(): {
		exists: boolean
		status: "connecting" | "connected" | "disconnected"
		disabled: boolean
		toolsCount: number
		error?: string
	} | null {
		if (!this.builtInConnection) {
			return null
		}

		return {
			exists: true,
			status: this.builtInConnection.server.status,
			disabled: this.builtInConnection.server.disabled,
			toolsCount: this.builtInConnection.server.tools?.length || 0,
			error: this.builtInConnection.server.error,
		}
	}
}
