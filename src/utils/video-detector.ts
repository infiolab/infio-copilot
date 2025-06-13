/**
 * 视频平台URL检测工具
 * 支持多种主流视频平台的URL识别
 */

// 各种视频平台的正则表达式
const VIDEO_PATTERNS = {
	// YouTube
	youtube: /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/i,
	
	// Bilibili
	bilibili: /(?:bilibili\.com\/video\/|b23\.tv\/)[A-Za-z0-9]+/i,
	
	// Vimeo
	vimeo: /(?:vimeo\.com\/)([0-9]+)/i,
	
	// Dailymotion
	dailymotion: /(?:dailymotion\.com\/video\/|dai\.ly\/)([A-Za-z0-9]+)/i,
	
	// TikTok
	tiktok: /(?:tiktok\.com\/@[^/]+\/video\/|vm\.tiktok\.com\/)[A-Za-z0-9]+/i,
	
	// Twitch
	twitch: /(?:twitch\.tv\/videos\/|clips\.twitch\.tv\/)[A-Za-z0-9]+/i,
	
	// 腾讯视频
	tencent: /(?:v\.qq\.com\/x\/cover\/|v\.qq\.com\/x\/page\/)[A-Za-z0-9]+/i,
	
	// 爱奇艺
	iqiyi: /(?:iqiyi\.com\/v_)[A-Za-z0-9]+/i,
	
	// 优酷
	youku: /(?:youku\.com\/v_show\/id_)[A-Za-z0-9]+/i,
	
	// Facebook/Meta
	facebook: /(?:facebook\.com\/watch\/|fb\.watch\/)[A-Za-z0-9]+/i,
	
	// Instagram
	instagram: /(?:instagram\.com\/(?:p|reel)\/)[A-Za-z0-9_-]+/i,
	
	// Twitter/X
	twitter: /(?:twitter\.com\/[^/]+\/status\/|x\.com\/[^/]+\/status\/)[0-9]+/i,
	
	// 抖音
	douyin: /(?:douyin\.com\/video\/)[0-9]+/i,
	
	// 快手
	kuaishou: /(?:kuaishou\.com\/short-video\/)[A-Za-z0-9]+/i,
	
	// 小红书
	xiaohongshu: /(?:xiaohongshu\.com\/explore\/)[A-Za-z0-9]+/i,
	
	// 微博视频
	weibo: /(?:weibo\.com\/[^/]+\/[A-Za-z0-9]+|weibo\.cn\/sinaurl)/i,
	
	// Rumble
	rumble: /(?:rumble\.com\/)[A-Za-z0-9_-]+/i,
	
	// Odysee
	odysee: /(?:odysee\.com\/@[^/]+\/)[A-Za-z0-9_-]+/i,
	
	// JW Player (通用嵌入式播放器)
	jwplayer: /(?:jwplayer\.com\/players\/)[A-Za-z0-9_-]+/i,
	
	// 通用视频文件扩展名
	videoFile: /\.(mp4|avi|mov|wmv|flv|webm|mkv|m4v|3gp|ogv)(\?.*)?$/i,
	
	// 通用视频流媒体
	streaming: /(?:stream|live|video|watch|play).*\.(m3u8|mpd|f4m)(\?.*)?$/i
}

export type VideoProvider = keyof typeof VIDEO_PATTERNS

/**
 * 检测URL是否为视频内容
 * @param url 要检测的URL
 * @returns 是否为视频URL
 */
export function isVideoUrl(url: string): boolean {
	return Object.values(VIDEO_PATTERNS).some(pattern => pattern.test(url))
}

/**
 * 检测URL属于哪个视频平台
 * @param url 要检测的URL
 * @returns 视频平台名称，如果不是视频URL则返回null
 */
export function getVideoProvider(url: string): VideoProvider | null {
	for (const [provider, pattern] of Object.entries(VIDEO_PATTERNS)) {
		if (pattern.test(url)) {
			return provider as VideoProvider
		}
	}
	return null
}

/**
 * 检测特定平台的视频URL
 * @param url 要检测的URL
 * @param provider 视频平台
 * @returns 是否为指定平台的视频URL
 */
export function isVideoUrlFromProvider(url: string, provider: VideoProvider): boolean {
	const pattern = VIDEO_PATTERNS[provider]
	return pattern ? pattern.test(url) : false
}

/**
 * 从URL中提取视频ID（如果可能）
 * @param url 视频URL
 * @returns 视频ID或null
 */
export function extractVideoId(url: string): string | null {
	const provider = getVideoProvider(url)
	if (!provider) return null
	
	const pattern = VIDEO_PATTERNS[provider]
	const match = url.match(pattern)
	
	// 返回第一个捕获组（如果存在）
	return match && match[1] ? match[1] : null
}

/**
 * 获取支持的视频平台列表
 * @returns 支持的视频平台名称数组
 */
export function getSupportedVideoProviders(): VideoProvider[] {
	return Object.keys(VIDEO_PATTERNS) as VideoProvider[]
}

// 为了向后兼容，保留原有的YouTube检测函数
export function isYoutubeUrl(url: string): boolean {
	return isVideoUrlFromProvider(url, 'youtube')
}

// 导出常用的视频平台检测函数
export const isYouTubeUrl = isYoutubeUrl // 别名
export const isBilibiliUrl = (url: string) => isVideoUrlFromProvider(url, 'bilibili')
export const isVimeoUrl = (url: string) => isVideoUrlFromProvider(url, 'vimeo')
export const isTikTokUrl = (url: string) => isVideoUrlFromProvider(url, 'tiktok')
export const isTwitchUrl = (url: string) => isVideoUrlFromProvider(url, 'twitch') 
