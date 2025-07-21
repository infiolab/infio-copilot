import https from 'https';

import { htmlToMarkdown, requestUrl } from 'obsidian';

import { JINA_BASE_URL, SERPER_BASE_URL } from '../constants';
import { RAGEngine } from '../core/rag/rag-engine';

import { getVideoProvider, isVideoUrl } from './video-detector';
import { YoutubeTranscript } from './youtube-transcript';


interface SearchResult {
	title: string;
	link: string;
	snippet: string;
	snippet_embedding: number[];
	content?: string;
}

interface SearchResponse {
	organic_results?: SearchResult[];
}


export interface EventProps {
	[key: string]: string | number | boolean
}

export async function onEnt(
	N: string,
	props?: EventProps,
): Promise<void> {
	return new Promise<void>((resolve) => {
		try {
			const eventUrl = `obsidian://plugin/infio-copilot/${N}`

			const payload = {
				name: N,
				url: eventUrl,
				domain: "copilot.infio.app",
				...(props && Object.keys(props).length > 0 && { props })
			}

			const postData = JSON.stringify(payload)
			const apiUrl = new URL(`https://hubs.infio.app/api/event`)

			const options = {
				hostname: apiUrl.hostname,
				port: apiUrl.port || 443,
				path: apiUrl.pathname,
				method: 'POST',
				rejectUnauthorized: false,
				headers: {
					'User-Agent': navigator.userAgent,
					'X-Forwarded-For': '127.0.0.1',
					'Content-Type': 'application/json',
					'Content-Length': Buffer.byteLength(postData),
					'X-Debug-Request': 'true'
				}
			}

			const req = https.request(options, (res) => {
				let data = ''
				res.on('data', (chunk) => { data += chunk })
				res.on('end', () => {
					if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
						// console.log(`✅ successfully: ${N}`)
					} else {
						console.error(`❌ (${res.statusCode}):`, data)
					}
					resolve()
				})
			})

			req.on('error', (error) => {
				console.error('❌ Failed:', error)
				resolve()
			})

			req.write(postData)
			req.end()

		} catch (error) {
			console.error('❌ Failed:', error)
			resolve()
		}
	})
} 

// 添加余弦相似度计算函数
function cosineSimilarity(vecA: number[], vecB: number[]): number {
	const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
	const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
	const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

	return dotProduct / (magnitudeA * magnitudeB);
}

// 添加内容清理函数
function cleanWebContent(content: string): string {
	if (!content) return content;

	let cleanedContent = content;

	// 1. 移除 base64 图片数据
	cleanedContent = cleanedContent.replace(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g, '[Image]');

	// 2. 移除 HTTP/HTTPS 链接，但保留显示文本
	cleanedContent = cleanedContent.replace(/\[([^\]]*)\]\(https?:\/\/[^\s\)]+\)/g, '$1');

	// 3. 移除独立的 HTTP/HTTPS 链接
	cleanedContent = cleanedContent.replace(/https?:\/\/[^\s\n\r]+/g, '');

	// 4. 移除 markdown 图片语法
	cleanedContent = cleanedContent.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '[Image: $1]');

	// 5. 移除多余的空白行（超过2个连续换行）
	cleanedContent = cleanedContent.replace(/\n{3,}/g, '\n\n');

	// 6. 移除行首行尾的空格
	cleanedContent = cleanedContent.replace(/^[ \t]+|[ \t]+$/gm, '');

	// 7. 移除常见的网页导航元素和重复内容
	cleanedContent = cleanedContent.replace(/^\s*(Home|Navigation|Menu|Footer|Header|Sidebar|Advertisement|Ad|Cookie|Privacy Policy|Terms of Service|Subscribe|Newsletter|Follow us|Share|Like|Comment|Login|Sign up|Register)\s*$/gim, '');

	// 8. 移除空行开头的特殊字符
	cleanedContent = cleanedContent.replace(/^\s*[-•·*]\s*$/gm, '');

	// 9. 移除过短的行（可能是无意义的导航或标签）
	cleanedContent = cleanedContent.split('\n')
		.filter(line => {
			const trimmed = line.trim();
			// 保留空行和长度大于3的行，或者看起来像标题的行
			return trimmed === '' || trimmed.length > 3 || /^#{1,6}\s/.test(trimmed);
		})
		.join('\n');

	// 10. 最终清理多余的空白
	cleanedContent = cleanedContent.replace(/\n{2,}/g, '\n\n').trim();

	return cleanedContent;
}

async function serperSearch(query: string, serperApiKey: string, serperSearchEngine: string): Promise<SearchResult[]> {
	return new Promise((resolve, reject) => {
		const url = `${SERPER_BASE_URL}?q=${encodeURIComponent(query)}&engine=${serperSearchEngine}&api_key=${serperApiKey}&num=20`;
		https.get(url, (res) => {
			let data = '';

			res.on('data', (chunk: Buffer) => {
				data += chunk.toString();
			});

			res.on('end', () => {
				try {
					let parsedData: SearchResponse;
					try {
						parsedData = JSON.parse(data);
					} catch {
						parsedData = { organic_results: undefined };
					}
					const results = parsedData?.organic_results;

					if (!results) {
						resolve([]);
						return;
					}

					resolve(results);

					// const formattedResults = results.map((item: SearchResult) => {
					// 	return `title: ${item.title}\nurl: ${item.link}\nsnippet: ${item.snippet}\n`;
					// }).join('\n\n');

					// resolve(formattedResults);
				} catch (error) {
					reject(error);
				}
			});
		}).on('error', (error: Error) => {
			console.error("serper search error: ", error)
			reject(error);
		});
	});
}

async function filterByEmbedding(query: string, results: SearchResult[], ragEngine: RAGEngine): Promise<SearchResult[]> {

	// 如果没有结果，直接返回空数组
	if (results.length === 0) {
		return [];
	}

	// 获取查询的嵌入向量
	const queryEmbedding = await ragEngine.getEmbedding(query);

	// 并行处理所有结果的嵌入向量计算
	const processedResults = await Promise.all(
		results.map(async (result) => {
			const resultEmbedding = await ragEngine.getEmbedding(result.snippet);
			const similarity = cosineSimilarity(queryEmbedding, resultEmbedding);

			return {
				...result,
				similarity,
				snippet_embedding: resultEmbedding
			};
		})
	);

	// 根据相似度过滤和排序结果
	const filteredResults = processedResults
		.filter(result => result.similarity > 0.5)
		.sort((a, b) => b.similarity - a.similarity)
		.slice(0, 5);

	return filteredResults;
}

async function fetchByLocalTool(url: string): Promise<string> {
	// 检查是否为视频内容
	if (isVideoUrl(url)) {
		const provider = getVideoProvider(url)
		
		// 对于YouTube，使用现有的转录功能
		if (provider === 'youtube') {
			try {
				// TODO: pass language based on user preferences
				const { title, transcript } =
					await YoutubeTranscript.fetchTranscriptAndMetadata(url)

				return `Title: ${title}
Video Transcript:
${transcript.map((t) => `${t.offset}: ${t.text}`).join('\n')}`
			} catch (error) {
				console.warn('Failed to extract YouTube transcript:', error)
				// 如果转录失败，返回视频信息提示
				return `Video Content Detected: ${url}
Platform: YouTube
Note: This is a video content. Transcript extraction failed. Please use specialized video processing tools for content analysis.`
			}
		}
		
		// 对于其他视频平台，返回视频信息提示
		return `Video Content Detected: ${url}
Platform: ${provider || 'Unknown'}
Note: This is a video content. Please use specialized video processing tools for content analysis.`
	}

	// 非视频内容，使用常规方式获取网页内容
	const response = await requestUrl({ url })
	return htmlToMarkdown(response.text)
}

async function fetchByJina(url: string, apiKey: string): Promise<string> {
	return new Promise((resolve) => {
		const jinaUrl = `${JINA_BASE_URL}/${url}`;

		const jinaHeaders = {
			'Authorization': `Bearer ${apiKey}`,
			'X-No-Cache': 'true',
		};

		const jinaOptions: https.RequestOptions = {
			method: 'GET',
			headers: jinaHeaders,
		};

		const req = https.request(jinaUrl, jinaOptions, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
					// check if there is an error response
					const response = JSON.parse(data);
					if (response.code && response.message) {
						console.error(`JINA API error: ${response.message}`);
						resolve(`fetch jina content error: ${response.message}`);
						return;
					}
					resolve(data);
				} catch (e) {
					// if not json format, maybe normal content
					resolve(data);
				}
			});
		});

		req.on('error', (e) => {
			console.error(`Error: ${e.message}`);
			resolve(`fetch jina error: ${e.message}`);
		});

		req.end();
	});
}

export async function fetchUrlContent(url: string, apiKey: string): Promise<string | null> {
	try {
		// 如果是视频内容，直接使用本地工具处理
		if (isVideoUrl(url)) {
			return await fetchByLocalTool(url);
		}
		let content: string | null = null;
		const validJinaKey = apiKey && apiKey !== '';
		if (validJinaKey) {
			try {
				content = await fetchByJina(url, apiKey);
			} catch (error) {
				console.error(`Failed to fetch URL by jina: ${url}`, error);
				content = await fetchByLocalTool(url);
			}
		} else {
			content = await fetchByLocalTool(url);
		}
		// 应用内容清理
		const cleanedContent = cleanWebContent(content);
		return cleanedContent;
	} catch (error) {
		console.error(`Failed to fetch URL content: ${url}`, error);
		return null;
	}
}

export interface WebSearchResult {
	url: string;
	title: string;
	content: string;
	snippet: string;
}

export async function webSearch(
	query: string,
	serperApiKey: string,
	serperSearchEngine: string,
	jinaApiKey: string,
	ragEngine: RAGEngine
): Promise<WebSearchResult[]> {
	try {
		const results = await serperSearch(query, serperApiKey, serperSearchEngine);
		const filteredResults = await filterByEmbedding(query, results, ragEngine);
		console.log("filteredResults", filteredResults)
		const filteredResultsWithContent = await Promise.all(filteredResults.map(async (result) => {
			let content = await fetchUrlContent(result.link, jinaApiKey);
			if (!content || content.length === 0) {
				// 如果获取内容失败，使用 snippet 并进行清理
				content = cleanWebContent(result.snippet);
			}
			return {
				url: result.link,
				title: result.title,
				snippet: result.snippet,
				content: content
			};
		}));
		console.log("filteredResultsWithContent", filteredResultsWithContent)
		return filteredResultsWithContent;
	} catch (error) {
		console.error(`Failed to web search: ${query}`, error);
		return [];
	}
}

export async function fetchUrlsContent(urls: string[], apiKey: string): Promise<string> {
	return new Promise((resolve) => {
		const results = urls.map(async (url) => {
			try {
				const content = await fetchUrlContent(url, apiKey);
				return `<url_content url="${url}">\n${content}\n</url_content>`;
			} catch (error) {
				console.error(`Failed to fetch URL content: ${url}`, error);
				return `<url_content url="${url}">\n fetch content error: ${error}\n</url_content>`;
			}
		});

		Promise.all(results).then((texts) => {
			resolve(texts.join('\n\n'));
		}).catch((error) => {
			console.error('fetch urls content error', error);
			resolve('fetch urls content error'); // even if error, return some content
		});
	});
}
