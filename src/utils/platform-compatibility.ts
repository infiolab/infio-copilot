import { Platform } from 'obsidian'

export interface PlatformCapabilities {
  isDesktop: boolean
  isMobile: boolean
  supportsDatabase: boolean
  supportsMCP: boolean
  supportsFileWatcher: boolean
  supportsShellEnv: boolean
  supportsChildProcess: boolean
}

export function getPlatformCapabilities(): PlatformCapabilities {
  const isMobile = Platform.isMobileApp
  const isDesktop = !isMobile

  return {
    isDesktop,
    isMobile,
    supportsDatabase: isDesktop, // PGlite 主要在桌面端稳定
    supportsMCP: isDesktop, // MCP 需要 Node.js 环境
    supportsFileWatcher: isDesktop, // chokidar 不支持移动端
    supportsShellEnv: isDesktop, // shell-env 仅桌面端
    supportsChildProcess: isDesktop, // child_process 仅桌面端
  }
}

export function isMobilePlatform(): boolean {
  return Platform.isMobileApp
}

export function isDesktopPlatform(): boolean {
  return !Platform.isMobileApp
}

// 功能可用性检查
export function canUseFeature(feature: keyof PlatformCapabilities): boolean {
  const capabilities = getPlatformCapabilities()
  return capabilities[feature]
}

// 移动端功能降级提示
export function getMobileFeatureMessage(feature: string): string {
  const messages: Record<string, string> = {
    database: '移动端将使用简化的本地存储，部分向量搜索功能可能受限',
    mcp: 'MCP (模型上下文协议) 功能在移动端不可用',
    fileWatcher: '文件监听功能在移动端不可用，需要手动刷新',
    shellEnv: 'Shell 环境变量功能在移动端不可用',
    childProcess: '子进程功能在移动端不可用'
  }
  
  return messages[feature] || `${feature} 功能在移动端可能受限`
} 
