import { Notice } from 'obsidian'

export interface CrashReport {
	timestamp: string
	error: string
	stack?: string
	userAgent: string
	pluginVersion?: string
	obsidianVersion?: string
	context?: string
}

export class CrashReporter {
	private static instance: CrashReporter
	private crashReports: CrashReport[] = []
	private maxReports = 50

	static getInstance(): CrashReporter {
		if (!CrashReporter.instance) {
			CrashReporter.instance = new CrashReporter()
		}
		return CrashReporter.instance
	}

	/**
	 * 记录崩溃信息
	 */
	reportCrash(error: Error | string, context?: string) {
		const report: CrashReport = {
			timestamp: new Date().toISOString(),
			error: error instanceof Error ? error.message : String(error),
			stack: error instanceof Error ? error.stack : undefined,
			userAgent: navigator.userAgent,
			context,
		}

		this.crashReports.unshift(report)
		
		// Keep only the latest reports
		if (this.crashReports.length > this.maxReports) {
			this.crashReports = this.crashReports.slice(0, this.maxReports)
		}

		// Log to console with detailed information
		console.error(`[Infio Plugin Crash] ${report.timestamp}`, {
			error: report.error,
			stack: report.stack,
			context: report.context,
			userAgent: report.userAgent
		})
	}

	/**
	 * 显示友好的错误通知
	 */
	showUserFriendlyError(message: string, includeDebugInfo = true) {
		if (includeDebugInfo) {
			new Notice(
				`Infio 插件错误: ${message}\n\n请按 Ctrl+Shift+I (或 Cmd+Option+I) 打开开发者控制台查看详细信息`,
				10000
			)
		} else {
			new Notice(`Infio 插件错误: ${message}`, 5000)
		}
	}

	/**
	 * 获取最近的崩溃报告
	 */
	getRecentReports(count = 10): CrashReport[] {
		return this.crashReports.slice(0, count)
	}

	/**
	 * 导出崩溃报告为文本
	 */
	exportReports(): string {
		if (this.crashReports.length === 0) {
			return 'No crash reports found.'
		}

		let report = '=== Infio Plugin Crash Reports ===\n\n'
		
		this.crashReports.forEach((crash, index) => {
			report += `--- Report ${index + 1} ---\n`
			report += `Time: ${crash.timestamp}\n`
			report += `Error: ${crash.error}\n`
			if (crash.context) {
				report += `Context: ${crash.context}\n`
			}
			if (crash.stack) {
				report += `Stack trace:\n${crash.stack}\n`
			}
			report += `User Agent: ${crash.userAgent}\n\n`
		})

		return report
	}

	/**
	 * 清理旧的崩溃报告
	 */
	clearReports() {
		this.crashReports = []
		console.log('[Infio Plugin] Crash reports cleared')
	}

	/**
	 * 检查是否有频繁崩溃
	 */
	checkForFrequentCrashes(): boolean {
		const recentCrashes = this.crashReports.filter(report => {
			const reportTime = new Date(report.timestamp).getTime()
			const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
			return reportTime > fiveMinutesAgo
		})

		return recentCrashes.length >= 5
	}
}

/**
 * 全局错误处理器包装器
 */
export function withErrorHandler<T extends (...args: any[]) => any>(
	fn: T,
	context?: string
): T {
	return ((...args: any[]) => {
		try {
			const result = fn(...args)
			
			// Handle async functions
			if (result instanceof Promise) {
				return result.catch((error) => {
					CrashReporter.getInstance().reportCrash(error, context)
					throw error
				})
			}
			
			return result
		} catch (error) {
			CrashReporter.getInstance().reportCrash(error as Error, context)
			throw error
		}
	}) as T
}

/**
 * 异步函数错误处理器
 */
export function withAsyncErrorHandler<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	context?: string
): T {
	return (async (...args: any[]) => {
		try {
			return await fn(...args)
		} catch (error) {
			CrashReporter.getInstance().reportCrash(error as Error, context)
			throw error
		}
	}) as T
} 
