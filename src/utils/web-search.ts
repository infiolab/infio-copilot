// 条件导入 Node.js 模块
let https: any = null

try {
	if (typeof window === 'undefined' || !(window as any).Platform?.isMobileApp) {
		https = require('https')
	}
} catch (error) {
	console.log('移动端跳过 https 模块导入:', error.message)
}

import { htmlToMarkdown, requestUrl } from 'obsidian';

import { JINA_BASE_URL, SERPER_BASE_URL } from '../constants';
import { RAGEngine } from '../core/rag/rag-engine';

import { YoutubeTranscript, isYoutubeUrl } from './youtube-transcript';


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
			// 移动端不支持此功能，直接返回
			if (!https) {
				console.log('移动端: onEnt 不可用')
				resolve()
				return
			}

			const eventUrl = `obsidian://plugin/infio-copilot/${N}`

			const payload = {
				name: N,
				url: eventUrl,
				domain: "copilot.infio.app",
				...(props && Object.keys(props).length > 0 && { props })
			}

			const postData = JSON.stringify(payload)
			const apiUrl = new URL(`https://hubs.infio.app/api/event`)
			
			// 移动端兼容的 Content-Length 计算
			const contentLength = typeof Buffer !== 'undefined' 
				? Buffer.byteLength(postData) 
				: new Blob([postData]).size

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
					'Content-Length': contentLength,
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

async function serperSearch(query: string, serperApiKey: string, serperSearchEngine: string): Promise<SearchResult[]> {
	return new Promise((resolve, reject) => {
		// 移动端不支持此功能
		if (!https) {
			console.log('移动端: serperSearch 不可用')
			resolve([])
			return
		}

		const url = `${SERPER_BASE_URL}?q=${encodeURIComponent(query)}&engine=${serperSearchEngine}&api_key=${serperApiKey}&num=20`;
		https.get(url, (res: any) => {
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

async function filterByEmbedding(query: string, results: SearchResult[], ragEngine: any): Promise<SearchResult[]> {

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
	if (isYoutubeUrl(url)) {
		// TODO: pass language based on user preferences
		const { title, transcript } =
			await YoutubeTranscript.fetchTranscriptAndMetadata(url)

		return `Title: ${title}
Video Transcript:
${transcript.map((t) => `${t.offset}: ${t.text}`).join('\n')}`
	}

	const response = await requestUrl({ url })

	return htmlToMarkdown(response.text)
}

async function fetchByJina(url: string, apiKey: string): Promise<string> {
	return new Promise((resolve) => {
		// 移动端不支持此功能
		if (!https) {
			console.log('移动端: fetchByJina 不可用')
			resolve('移动端不支持网页内容获取')
			return
		}

		const jinaUrl = `${JINA_BASE_URL}/${url}`;

		const jinaHeaders = {
			'Authorization': `Bearer ${apiKey}`,
			'X-No-Cache': 'true',
		};

		const jinaOptions: any = {
			method: 'GET',
			headers: jinaHeaders,
		};

		const req = https.request(jinaUrl, jinaOptions, (res: any) => {
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
		// 移动端简化处理
		if (!https) {
			console.log('移动端: fetchUrlContent 不可用')
			return `移动端暂不支持获取 ${url} 的内容`
		}

		if (isYoutubeUrl(url)) {
			return await fetchByOther(url);
		}
		let content: string | null = null;
		const validJinaKey = apiKey && apiKey !== '';
		if (validJinaKey) {
			try {
				content = await fetchByJina(url, apiKey);
			} catch (error) {
				console.error(`Failed to fetch URL by jina: ${url}`, error);
				content = await fetchByOther(url);
			}
		} else {
			content = await fetchByOther(url);
		}
		return content ? content.replaceAll(/\n{2,}/g, '\n') : null;
	} catch (error) {
		console.error(`Failed to fetch URL content: ${url}`, error);
		return null;
	}
}

// 使用 Obsidian 的 requestUrl 作为备用方案
async function fetchByOther(url: string): Promise<string> {
	try {
		const response = await requestUrl({
			url: url,
			method: 'GET',
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; ObsidianBot/1.0)'
			}
		})
		return htmlToMarkdown(response.text)
	} catch (error) {
		console.error(`Failed to fetch by requestUrl: ${url}`, error)
		return `无法获取 ${url} 的内容: ${error.message}`
	}
}

export async function webSearch(
	query: string,
	serperApiKey: string,
	serperSearchEngine: string,
	jinaApiKey: string,
	ragEngine: any  // 支持 RAGEngine 或 MobileRAGEngine
): Promise<string> {
	try {
		// 移动端简化处理
		if (!https) {
			console.log('移动端: webSearch 不可用')
			return `移动端暂不支持网络搜索功能。搜索查询: "${query}"`
		}

		const results = await serperSearch(query, serperApiKey, serperSearchEngine);
		const filteredResults = await filterByEmbedding(query, results, ragEngine);
		const filteredResultsWithContent = await Promise.all(filteredResults.map(async (result) => {
			let content = await fetchUrlContent(result.link, jinaApiKey);
			if (!content || content.length === 0) {
				content = result.snippet;
			}
			return `<url_content url="${result.link}">\n${content}\n</url_content>`;
		}));
		return filteredResultsWithContent.join('\n\n');
	} catch (error) {
		console.error(`Failed to web search: ${query}`, error);
		return "web search error";
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
