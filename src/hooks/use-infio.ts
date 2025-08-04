import { requestUrl } from "obsidian";

import { INFIO_BASE_URL } from "../constants";

// 获取模型列表的 API 函数
export const fetchModelsList = async (apiKey: string): Promise<any> => {
	const response = await requestUrl({
		url: `${INFIO_BASE_URL}/model_group/info`,
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});

	return response.json;
};


// 获取 MCP 列表的 API 函数
export const fetchMcpsList = async (apiKey: string): Promise<any> => {
	const response = await requestUrl({
		url: `${INFIO_BASE_URL}/mcp/list`,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': `Bearer ${apiKey}`
		}
	});

	return response.json;
};


// 获取 Prompt 列表的 API 函数
export const fetchPromptsList = async (apiKey: string, filters?: {
	category?: string;
	strategy?: string;
	search?: string;
	page?: number;
	size?: number;
}): Promise<any> => {
	const params = new URLSearchParams();
	if (filters?.category && filters.category !== 'all') {
		params.append('category', filters.category);
	}
	if (filters?.strategy && filters.strategy !== 'all') {
		params.append('strategy', filters.strategy);
	}
	if (filters?.search) {
		params.append('search', filters.search);
	}
	if (filters?.page) {
		params.append('page', filters.page.toString());
	}
	if (filters?.size) {
		params.append('size', filters.size.toString());
	}

	const url = `${INFIO_BASE_URL}/prompt/list${params.toString() ? `?${params.toString()}` : ''}`;

	const response = await requestUrl({
		url,
		method: 'GET',
		headers: {
			'Authorization': `Bearer ${apiKey}`
		},
	});

	return response.json;
};
