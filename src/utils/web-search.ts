import https from 'https';

import { htmlToMarkdown, requestUrl } from 'obsidian';
import {
  search as ddgSearch,
  SearchResult as DDGSearchResult,
} from 'duck-duck-scrape';

import {
  SERPAPI_BASE_URL,
  JINA_SEARCH_BASE_URL,
  SCRAPINGDOG_BASE_URL,
  SERPER_BASE_URL,
  JINA_FETCH_BASE_URL,
  BRAVE_BASE_URL,
} from '../constants';
import { RAGEngine } from '../core/rag/rag-engine';
import { WebSearchSettings } from '../types/settings';

import { isVideoUrl, getVideoProvider } from './video-detector';
import { YoutubeTranscript, isYoutubeUrl } from './youtube-transcript';


interface SearchResult {
	title: string;
	link: string;
	snippet: string;
	snippet_embedding: number[];
	content?: string;
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

async function serpapiSearch(query: string, searchSettings: WebSearchSettings): Promise<SearchResult[]> {
	return new Promise((resolve, reject) => {
		const apiKey = searchSettings.serpapiApiKey;
		const searchEngine = searchSettings.serpapiSearchEngine;
		const url = `${SERPAPI_BASE_URL}?q=${encodeURIComponent(query)}&engine=${searchEngine}&api_key=${apiKey}&num=20`;
		https.get(url, (res: any) => {
			let data = '';

			res.on('data', (chunk: Buffer) => {
				data += chunk.toString();
			});

			res.on('end', () => {
				try {
					let parsedData: {
            organic_results?: SearchResult[];
          };
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
			console.error("SerpAPI search error: ", error)
			reject(error);
		});
	});
}

// This function is untested since I don't have Scrapingdog API lol
async function scrapingdogSearch(query: string, searchSettings: WebSearchSettings): Promise<SearchResult[]> {
	return new Promise((resolve, reject) => {
		const apiKey = searchSettings.scrapingdogApiKey;
		const searchEngine = searchSettings.scrapingdogSearchEngine;

		let url: string;
    if (searchEngine === 'google') {
      url = `${SCRAPINGDOG_BASE_URL}/google/api_key=${apiKey}&query=${encodeURIComponent(query)}&results=20`;
    } else if (searchEngine === 'bing') {
      url = `${SCRAPINGDOG_BASE_URL}/bing/search/api_key=${apiKey}&query=${encodeURIComponent(query)}&results=20`;
    } else {
      throw new Error(`Unsupported search engine: ${searchEngine}`);
    }
		https.get(url, (res: any) => {
			let data = '';

			res.on('data', (chunk: Buffer) => {
				data += chunk.toString();
			});

			res.on('end', () => {
				try {
					let parsedData: {
            organic_data?: SearchResult[];
            bing_data?: SearchResult[];
          };
					try {
						parsedData = JSON.parse(data);
					} catch {
						parsedData = { };
					}
					let results: SearchResult[];
          if (searchEngine === 'google') {
            results = parsedData?.organic_data;
          } else if (searchEngine === 'bing') {
            results = parsedData?.bing_data;
          }

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
			console.error("Scrapingdog search error: ", error)
			reject(error);
		});
	});
}

// This one is also untested :)
async function serperSearch(query: string, searchSettings: WebSearchSettings): Promise<SearchResult[]> {
	return new Promise((resolve, reject) => {
		const apiKey = searchSettings.serperApiKey;
		const url = `${SERPER_BASE_URL}?q=${encodeURIComponent(query)}`;
    const headers = {
      'Content-Type': 'application/json',
			'X-API-KEY': `${apiKey}`,
		};
		const options: https.RequestOptions = {
			headers: headers,
		};
    
    https.get(url, options, (res: any) => {
			let data = '';

			res.on('data', (chunk: Buffer) => {
				data += chunk.toString();
			});

			res.on('end', () => {
				try {
					let parsedData: {
            organic?: SearchResult[];
          };
					try {
						parsedData = JSON.parse(data);
					} catch {
						parsedData = { organic: undefined };
					}
					const results = parsedData?.organic.slice(0, 20);

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
			console.error("Serper search error: ", error)
			reject(error);
		});
	});
}

// Including this one ;)
async function jinaSearch(query: string, searchSettings: WebSearchSettings): Promise<SearchResult[]> {
	return new Promise((resolve, reject) => {
    const apiKey = searchSettings.jinaApiKey;
    if (!apiKey || apiKey === '') {
      reject('Jina API key is not set');
      return;
    }
		const url = `${JINA_SEARCH_BASE_URL}/?q=${encodeURIComponent(query)}`;
		const headers = {
      'Accept': 'application/json',
			'Authorization': `Bearer ${apiKey}`,
			'X-Respond-With': 'no-content',
		};
		const options: https.RequestOptions = {
			headers: headers,
		};

		https.get(url, options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

      res.on('end', () => {
				try {
					let parsedData: {
            data?: SearchResult[];
          };
					try {
						parsedData = JSON.parse(data);
					} catch {
						parsedData = { data: undefined };
					}
					const results = parsedData?.data.slice(0, 20);

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
			console.error(`Jina search error: ${error.message}`);
			reject(error);
		});
	});
}

async function duckduckgoSearch(query: string): Promise<SearchResult[]> {
	return new Promise(async (resolve, reject) => {
    try {
      const data = await ddgSearch(query, {}, 20);

      let results: SearchResult[];
      data.results?.forEach((result: DDGSearchResult) => {
        results.push({
          title: result.title,
          link: result.url,
          snippet: result.description,
          snippet_embedding: [],
        });
      });

      if (!results) {
        resolve([]);
        return;
      }

      resolve(results);
    } catch(error) {
      console.error(`DuckDuckGo search error: ${error.message}`);
      reject(error);
    }
	});
}

// Including this one ;)
async function braveSearch(query: string, searchSettings: WebSearchSettings): Promise<SearchResult[]> {
	return new Promise((resolve, reject) => {
    const apiKey = searchSettings.braveApiKey;
    if (!apiKey || apiKey === '') {
      reject('Brave API key is not set');
      return;
    }
		const url = `${BRAVE_BASE_URL}/?q=${encodeURIComponent(query)}`;
		const headers = {
      'Accept': 'application/json',
			'X-Subscription-Token': `${apiKey}`,
		};
		const options: https.RequestOptions = {
			headers: headers,
		};

		https.get(url, options, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

      res.on('end', () => {
				try {
					let parsedData: SearchResult[];
					try {
						parsedData = JSON.parse(data);
					} catch {
						parsedData = [];
					}
					const results = parsedData;

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
			console.error(`Brave search error: ${error.message}`);
			reject(error);
		});
	});
}

async function loadSearchBackend(query: string, searchSettings: WebSearchSettings): Promise<SearchResult[]> {
  return new Promise((resolve, reject) => {
    if (searchSettings.webSearchBackend === 'serpapi') {
      resolve(serpapiSearch(query, searchSettings));
      return;
    } else if (searchSettings.webSearchBackend === 'jina') {
      resolve(jinaSearch(query, searchSettings));
      return;
    } else if (searchSettings.webSearchBackend === 'scrapingdog') {
      resolve(scrapingdogSearch(query, searchSettings));
      return;
    } else if (searchSettings.webSearchBackend === 'serper') {
      resolve(serperSearch(query, searchSettings));
      return;
    } else if (searchSettings.webSearchBackend === 'duckduckgo') {
      resolve(duckduckgoSearch(query));
      return;
    } else if (searchSettings.webSearchBackend === 'brave') {
      resolve(braveSearch(query, searchSettings));
      return;
    }

    reject(`Unsupported web search backend: ${searchSettings.webSearchBackend}`);
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
		const jinaFetchUrl = `${JINA_FETCH_BASE_URL}/${url}`;

		const validJinaKey = apiKey && apiKey !== '';
		const jinaHeaders = {
			'Authorization': validJinaKey && `Bearer ${apiKey}`,
			'X-No-Cache': 'true',
		};

		const jinaOptions: https.RequestOptions = {
			method: 'GET',
			headers: jinaHeaders,
		};

		const req = https.request(jinaFetchUrl, jinaOptions, (res) => {
			let data = '';

			res.on('data', (chunk) => {
				data += chunk;
			});

			res.on('end', () => {
				try {
					// check if there is an error response
					const response = JSON.parse(data);
					if (response.code && response.message) {
						console.error(`Jina API error: ${response.message}`);
						resolve(`Fetch Jina content error: ${response.message}`);
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
			resolve(`Fetch Jina error: ${e.message}`);
		});

		req.end();
	});
}

export async function fetchUrlContent(url: string, searchSettings: WebSearchSettings): Promise<string | null> {
	try {
		// 如果是视频内容，直接使用本地工具处理
		if (isVideoUrl(url)) {
			return await fetchByLocalTool(url);
		}
		let content: string | null = null;
		
		const fetchBackend = searchSettings.urlFetchBackend;
		if (fetchBackend === 'jina') {
			try {
				content = await fetchByJina(url, searchSettings.jinaApiKey);
			} catch (error) {
				console.error(`Failed to fetch URL by jina: ${url}`, error);
				content = await fetchByLocalTool(url);
			}
		} else {
			content = await fetchByLocalTool(url);
		}

		return content.replaceAll(/\n{2,}/g, '\n');
	} catch (error) {
		console.error(`Failed to fetch URL content: ${url}`, error);
		return null;
	}
}

export async function webSearch(
	query: string,
	searchSettings: WebSearchSettings,
	ragEngine: RAGEngine
): Promise<string> {
	try {
		const results = await loadSearchBackend(query, searchSettings);
		const filteredResults = await filterByEmbedding(query, results, ragEngine);
		const filteredResultsWithContent = await Promise.all(filteredResults.map(async (result) => {
			let content = await fetchUrlContent(result.link, searchSettings);
			if (content.length === 0) {
				content = result.snippet;
			}
			return `<url_content url="${result.link}">\n${content}\n</url_content>`;
		}));
		return filteredResultsWithContent.join('\n\n');
	} catch (error) {
		console.error(`Failed to web search: ${query}`, error);
		return `Failed to web search "${query}" with the following error: ${error}`;
	}
}

export async function fetchUrlsContent(urls: string[], searchSettings: WebSearchSettings): Promise<string> {
	return new Promise((resolve) => {
		const results = urls.map(async (url) => {
			try {
				const content = await fetchUrlContent(url, searchSettings);
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
