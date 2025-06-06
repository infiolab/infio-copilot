import { Platform } from 'obsidian';

// 条件导入 Node.js 模块
let os: any = null
try {
	if (typeof window === 'undefined' || !(window as any).Platform?.isMobileApp) {
		os = require("os")
	}
} catch (error) {
	console.log('移动端跳过 os 模块导入:', error.message)
}


export function getSystemInfoSection(cwd: string): string {
	let platformName = "Unknown"
	if (Platform.isMacOS) {
		platformName = "Macos"
	} else if (Platform.isWin) {
		platformName = "Windows"
	} else if (Platform.isLinux) {
		platformName = "Linux"
	} else if (Platform.isMobileApp) {
		if (Platform.isTablet) {
			platformName = "iPad"
		} else if (Platform.isPhone) {
			platformName = "iPhone"
		} else if (Platform.isAndroidApp) {
			platformName = "Android"
		}
	} else {
		platformName = "Unknown"
	}
	const details = `====

SYSTEM INFORMATION

Platform: ${platformName}
Current Obsidian Directory: ${cwd.toPosix()}
`

	return details
}
