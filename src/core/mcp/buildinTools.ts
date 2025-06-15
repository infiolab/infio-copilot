export const BUILTIN_TOOLS = [
	{
		"name": "CONVERT_DOCUMENT",
		"description": "Convert a document to markdown using the Marker API. Supports PDF, Word, Excel, PowerPoint, HTML, and EPUB files.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"file_content": {
					"type": "string",
					"description": "Base64 encoded file content"
				},
				"file_type": {
					"type": "string",
					"description": "File type extension (pdf, docx, xlsx, etc.) without the dot"
				}
			},
			"required": [
				"file_content",
				"file_type"
			]
		},
		"mcp_info": {
			"server_name": "internal"
		}
	},
	{
		"name": "CONVERT_VIDEO",
		"description": "Convert a video url, like youtube url to markdown. Supports youtube, bilibili, tiktok, douyin, kuaishou, etc.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"url": {
					"type": "string",
					"description": "Video url, like youtube url, bilibili url, tiktok url, douyin url, kuaishou url, etc."
				},
				"detect_language": {
					"type": "string",
					"description": "Detect language of the video, like en, zh, etc."
				}
			},
			"required": [
				"url",
				"detect_language"
			]
		},
		"mcp_info": {
			"server_name": "internal"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_DUCK_DUCK_GO_SEARCH",
		"description": "The duckduckgosearch class utilizes the composio duckduckgo search api to perform searches, focusing on web information and details. it leverages the duckduckgo search engine via the composio duckduckgo search api to retrieve relevant web data based on the provided query.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio DuckDuckGo Search API, specifying the search topic."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_EVENT_SEARCH",
		"description": "The eventsearch class enables scraping of google events search queries. it conducts an event search using the composio events search api, retrieving information on events such as concerts, festivals, and other activities based on the provided query.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio Events Search API, specifying the event topic."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_EXA_SIMILARLINK",
		"description": "Perform a search to find similar links and retrieve a list of relevant results. the search can optionally return contents.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"category": {
					"type": "string",
					"description": " A data category to focus on, with higher comprehensivity and data cleanliness. Categories right now include company, research paper, news, github, tweet, movie, song, personal site, and pdf"
				},
				"endCrawlDate": {
					"type": "string",
					"description": "Results will include links crawled before this date. For e.g. '2023-01-01T00:00:00Z', '2023-01-15T00:00:00Z', '2023-02-01T00:00:00Z'."
				},
				"endPublishedDate": {
					"type": "string",
					"description": "Only links published before this date will be returned. For e.g. '2023-01-01', '2023-01-15', '2023-02-01'."
				},
				"excludeDomains": {
					"type": "array",
					"items": {
						"type": "string"
					},
					"description": "List of domains to exclude in the search. For e.g. ['example.com'], ['news.com'], ['blog.com']."
				},
				"includeDomains": {
					"type": "array",
					"items": {
						"type": "string"
					},
					"description": "List of domains to include in the search. For e.g. ['example.com'], ['news.com'], ['blog.com']."
				},
				"numResults": {
					"type": "integer",
					"description": "Number of search results to return. For e.g. 10, 20, 30."
				},
				"startCrawlDate": {
					"type": "string",
					"description": "Results will include links crawled after this date. For e.g. '2023-01-01T00:00:00Z', '2023-01-15T00:00:00Z', '2023-02-01T00:00:00Z'."
				},
				"startPublishedDate": {
					"type": "string",
					"description": "Only links published after this date will be returned. For e.g. '2023-01-01', '2023-01-15', '2023-02-01'."
				},
				"type": {
					"type": "string",
					"description": "The type of search: 'keyword', 'neural', or 'magic'. For e.g. 'neural', 'keyword', 'magic'."
				},
				"url": {
					"type": "string",
					"description": "The url for which you would like to find similar links. For e.g. 'https://slatestarcodex.com/2014/07/30/meditations-on-moloch/', 'https://ww.google.com/'"
				},
				"useAutoprompt": {
					"type": "boolean",
					"description": "If true, your query will be converted to an Composio Similarlinks query. For e.g. True, False, True."
				}
			},
			"required": [
				"url"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_FINANCE_SEARCH",
		"description": "The financesearch class utilizes the composio finance search api to conduct financial searches, focusing on financial data and stock information. it leverages the google finance search engine via the composio finance search api to retrieve pertinent financial details based on the provided query.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio Finance Search API, specifying the financial topic or stock symbol."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_GOOGLE_MAPS_SEARCH",
		"description": "The googlemapssearch class performs a location-specific search using the composio goolge maps search api. this class extends the functionality of the base action class to specifically target locations related to the given query. by utilizing the google maps search engine through the composio goolge maps search api, it fetches the most relevant location data based on the input query. the `googlemapssearch` class is particularly useful for applications that need to retrieve and display location information about a specific area. it leverages the powerful search capabilities of google's maps search engine, ensuring that the returned results are accurate and relevant.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"ll": {
					"type": "string",
					"description": "GPS coordinates of location where you want your query to be applied."
				},
				"q": {
					"type": "string",
					"description": "The query you want to search."
				},
				"start": {
					"type": "integer",
					"description": "Used for pagenation"
				}
			},
			"required": [
				"q"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_IMAGE_SEARCH",
		"description": "The imagesearch class performs an image search using the composio image search api, to target image data and information. it uses the google images search engine through the composio image search api to fetch relevant image information based on the input query.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio Image Search API, specifying the image topic."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_NEWS_SEARCH",
		"description": "The newssearch class performs a news-specific search using the composio news search api. this class extends the functionality of the base action class to specifically target news articles related to the given query. by utilizing the google news search engine through the composio news search api, it fetches the most relevant news articles based on the input query. the `newssearch` class is particularly useful for applications that need to retrieve and display the latest news articles about a specific topic. it leverages the powerful search capabilities of google's news search engine, ensuring that the returned results are current and relevant.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio News Search API, specifying the topic for news search."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_SCHOLAR_SEARCH",
		"description": "Scholar api allows you to scrape results from a google scholar search query. the scholarsearch class performs an academic search using the composio scholar search api, academic papers and scholarly articles. it uses the google scholar search engine through the serp api to fetch relevant academic information based on the input query.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio Scholar Search API, specifying the academic topic or paper title."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_SEARCH",
		"description": "Perform a google search using the composio google search api.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio Google Search API."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_SHOPPING_SEARCH",
		"description": "The shoppingsearch class performs a product search using the composio shopping search api.it specifically target shopping results related to the given query. by utilizing the google shopping search engine through the composio shopping search api, it fetches the most relevant product listings based on the input query. the `shoppingsearch` class is particularly useful for applications that need to retrieve and display the latest product listings and shopping results for a specific item. it leverages the powerful search capabilities of google's shopping search engine, ensuring that the returned results are current and relevant.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"query": {
					"type": "string",
					"description": "The search query for the Composio Shopping Search API, specifying the product or item for shopping search."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_TAVILY_SEARCH",
		"description": "The composio llm search class serves as a gateway to the composio llm search api, allowing users to perform searches across a broad range of content with multiple filtering options. it accommodates complex queries, including both keyword and phrase searches, with additional parameters to fine-tune the search results. this class enables a tailored search experience by allowing users to specify the search depth, include images and direct answers, apply domain-specific filters, and control the number of results returned. it is designed to meet various search requirements, from quick lookups to in-depth research.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"exclude_domains": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {},
						"additionalProperties": false
					},
					"description": "A list of domain names to exclude from the search results. Results from these domains will not be included, which can help to filter out unwanted content."
				},
				"include_answer": {
					"type": "boolean",
					"description": "Specifies whether to include direct answers to the query in the search results. Useful for queries that expect a factual answer."
				},
				"include_domains": {
					"type": "array",
					"items": {
						"type": "object",
						"properties": {},
						"additionalProperties": false
					},
					"description": "A list of domain names to include in the search results. Only results from these specified domains will be returned, allowing for targeted searches."
				},
				"include_images": {
					"type": "boolean",
					"description": "A flag indicating whether to include images in the search results. When set to true, the response will contain image links related to the query."
				},
				"include_raw_content": {
					"type": "boolean",
					"description": "If set to true, the search results will include the raw content from the search index, which may contain unprocessed HTML or text."
				},
				"max_results": {
					"type": "integer",
					"description": "The maximum number of search results that the API should return. This limits the size of the result set for the query."
				},
				"query": {
					"type": "string",
					"description": "The primary text used to perform the search. This is the key term or phrase that the search functionality will use to retrieve results."
				},
				"search_depth": {
					"type": "string",
					"description": "Determines the thoroughness of the search. A 'basic' search might perform a quick and broad search, while 'advanced' could indicate a more intensive and narrow search."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "COMPOSIO_SEARCH_TRENDS_SEARCH",
		"description": "The trendssearch class performs a trend search using the google trends search api, to target trend data and information. it uses the google trends search engine through the google trends search api to fetch relevant trend information based on the input query.",
		"inputSchema": {
			"type": "object",
			"properties": {
				"data_type": {
					"anyOf": [
						{
							"type": "string"
						},
						{
							"enum": [
								"null"
							],
							"nullable": true
						}
					],
					"description": "Parameter defines the type of search you want to do. Available options: TIMESERIES - Interest over time (default) - Accepts both single and multiple queries per search. GEO_MAP - Compared breakdown by region - Accepts only multiple queries per search. GEO_MAP_0 - Interest by region - Accepts only single query per search. RELATED_TOPICS - Related topics - Accepts only single query per search. RELATED_QUERIES - Related queries - Accepts only single query per search."
				},
				"query": {
					"type": "string",
					"description": "The search query for the Google Trends Search API, specifying the trend topic."
				}
			},
			"required": [
				"query"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "search"
		}
	},
	{
		"name": "TEXT_TO_PDF_CONVERT_TEXT_TO_PDF",
		"description": "Convert text to pdf",
		"inputSchema": {
			"type": "object",
			"properties": {
				"file_type": {
					"type": "string",
					"description": "The type of file to convert to, choose between txt and markdown"
				},
				"text": {
					"type": "string",
					"description": "The text to convert to the specified file type"
				}
			},
			"required": [
				"file_type",
				"text"
			],
			"additionalProperties": false
		},
		"mcp_info": {
			"server_name": "text_to_pdf"
		}
	}
]