import { 
	extractVideoId,
	getSupportedVideoProviders,
	getVideoProvider,
	isBilibiliUrl,
	isTikTokUrl,
	isVideoUrl,
	isVimeoUrl
} from './video-detector'

describe('video-detector', () => {
	describe('isVideoUrl', () => {
		it('should correctly identify YouTube URLs', () => {
			expect(isVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true)
			expect(isVideoUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true)
		})

		it('should correctly identify Bilibili URLs', () => {
			expect(isVideoUrl('https://www.bilibili.com/video/BV1GJ411x7h7')).toBe(true)
			expect(isVideoUrl('https://b23.tv/BV1GJ411x7h7')).toBe(true)
		})

		it('should correctly identify Vimeo URLs', () => {
			expect(isVideoUrl('https://vimeo.com/123456789')).toBe(true)
		})

		it('should correctly identify TikTok URLs', () => {
			expect(isVideoUrl('https://www.tiktok.com/@username/video/1234567890')).toBe(true)
			expect(isVideoUrl('https://vm.tiktok.com/ZMeABCDEF/')).toBe(true)
		})

		it('should correctly identify video file URLs', () => {
			expect(isVideoUrl('https://example.com/video.mp4')).toBe(true)
			expect(isVideoUrl('https://example.com/movie.avi?t=123')).toBe(true)
			expect(isVideoUrl('https://example.com/clip.webm')).toBe(true)
		})

		it('should correctly reject non-video URLs', () => {
			expect(isVideoUrl('https://www.google.com')).toBe(false)
			expect(isVideoUrl('https://github.com/user/repo')).toBe(false)
			expect(isVideoUrl('https://docs.google.com/document/123')).toBe(false)
		})
	})

	describe('getVideoProvider', () => {
		it('should correctly identify YouTube provider', () => {
			expect(getVideoProvider('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('youtube')
			expect(getVideoProvider('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube')
		})

		it('should correctly identify Bilibili provider', () => {
			expect(getVideoProvider('https://www.bilibili.com/video/BV1GJ411x7h7')).toBe('bilibili')
		})

		it('should correctly identify Vimeo provider', () => {
			expect(getVideoProvider('https://vimeo.com/123456789')).toBe('vimeo')
		})

		it('should return null for non-video URLs', () => {
			expect(getVideoProvider('https://www.google.com')).toBeNull()
			expect(getVideoProvider('https://github.com/user/repo')).toBeNull()
		})
	})

	describe('extractVideoId', () => {
		it('should extract YouTube video IDs', () => {
			expect(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
			expect(extractVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
		})

		it('should extract Vimeo video IDs', () => {
			expect(extractVideoId('https://vimeo.com/123456789')).toBe('123456789')
		})

		it('should return null for non-video URLs', () => {
			expect(extractVideoId('https://www.google.com')).toBeNull()
		})
	})

	describe('platform-specific detectors', () => {
		it('should correctly detect Bilibili URLs', () => {
			expect(isBilibiliUrl('https://www.bilibili.com/video/BV1GJ411x7h7')).toBe(true)
			expect(isBilibiliUrl('https://www.youtube.com/watch?v=123')).toBe(false)
		})

		it('should correctly detect Vimeo URLs', () => {
			expect(isVimeoUrl('https://vimeo.com/123456789')).toBe(true)
			expect(isVimeoUrl('https://www.youtube.com/watch?v=123')).toBe(false)
		})

		it('should correctly detect TikTok URLs', () => {
			expect(isTikTokUrl('https://www.tiktok.com/@user/video/123')).toBe(true)
			expect(isTikTokUrl('https://www.youtube.com/watch?v=123')).toBe(false)
		})
	})

	describe('getSupportedVideoProviders', () => {
		it('should return an array of supported providers', () => {
			const providers = getSupportedVideoProviders()
			expect(Array.isArray(providers)).toBe(true)
			expect(providers.length).toBeGreaterThan(0)
			expect(providers).toContain('youtube')
			expect(providers).toContain('bilibili')
			expect(providers).toContain('vimeo')
		})
	})
}) 
