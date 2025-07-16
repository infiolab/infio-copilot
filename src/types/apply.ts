/**
 * 用于指定插入内容的工具参数
 */

import { v4 as uuidv4 } from 'uuid';

import { TransformationType } from '../core/transformations/trans-engine';

import { ChatUserMessage } from './chat';

export enum ApplyStatus {
	Idle = 0,
	Applied = 1,
	Failed = 2,
	Rejected = 3,
}

export type ReadFileToolArgs = {
	type: 'read_file';
	filepath?: string;
}

export type ListFilesToolArgs = {
	type: 'list_files';
	filepath?: string;
	recursive?: boolean;
}

export type MatchSearchFilesToolArgs = {
	type: 'match_search_files';
	filepath?: string;
	query?: string;
	file_pattern?: string;
	finish?: boolean;
}

export type RegexSearchFilesToolArgs = {
	type: 'regex_search_files';
	filepath?: string;
	regex?: string;
	file_pattern?: string;
	finish?: boolean;
}

export type SemanticSearchFilesToolArgs = {
	type: 'semantic_search_files';
	filepath?: string;
	query?: string;
	finish?: boolean;
}
export type WriteToFileToolArgs = {
	type: 'write_to_file';
	filepath?: string;
	content?: string;
	startLine?: number;
	endLine?: number;
}

export type InsertContentToolArgs = {
	type: 'insert_content';
	filepath?: string;
	content?: string;
	startLine?: number;
	endLine?: number;
}

export type SearchAndReplaceToolArgs = {
	type: 'search_and_replace';
	filepath: string;
	operations: {
		search: string;
		replace: string;
		startLine?: number;
		endLine?: number;
		useRegex?: boolean;
		ignoreCase?: boolean;
		regexFlags?: string;
	}[];
}

export type ApplyDiffToolArgs = {
	type: 'apply_diff';
	filepath: string;
	diff: string;
	finish?: boolean;
}

export type SearchWebToolArgs = {
	type: 'search_web';
	query: string;
	finish?: boolean;
}

export type FetchUrlsContentToolArgs = {
	type: 'fetch_urls_content';
	urls: string[];
	finish?: boolean;
}

export type SwitchModeToolArgs = {
	type: 'switch_mode';
	mode: string;
	reason: string;
	finish?: boolean;
}

export type UseMcpToolArgs = {
	type: 'use_mcp_tool';
	server_name: string;
	tool_name: string;
	parameters: Record<string, unknown>;
}

export type DataviewQueryToolArgs = {
	type: 'dataview_query';
	query: string;
	outputFormat: string;
	finish?: boolean;
}

export type CallTransformationsToolArgs = {
	type: 'call_transformations';
	path: string;
	transformation: TransformationType;
	finish?: boolean;
}

export type ManageFilesToolArgs = {
	type: 'manage_files';
	operations: Array<{
		action: 'create_folder' | 'move' | 'delete' | 'copy' | 'rename';
		path?: string;
		source_path?: string;
		destination_path?: string;
		new_name?: string;
	}>;
	finish?: boolean;
}

export type ToolArgs = ReadFileToolArgs | WriteToFileToolArgs | InsertContentToolArgs | SearchAndReplaceToolArgs | ListFilesToolArgs | MatchSearchFilesToolArgs | RegexSearchFilesToolArgs | SemanticSearchFilesToolArgs | SearchWebToolArgs | FetchUrlsContentToolArgs | SwitchModeToolArgs | ApplyDiffToolArgs | UseMcpToolArgs | DataviewQueryToolArgs | CallTransformationsToolArgs | ManageFilesToolArgs;

// 工具执行结果的统一接口
export interface ToolExecutionResult {
	type: string;
	applyMsgId: string;
	applyStatus: ApplyStatus;
	returnMsg?: ChatUserMessage;
	error?: string;
	// 工具执行结果内容，将直接附加到 assistant 消息上
	toolResultContent?: string;
}

// 工具执行成功结果
export interface ToolExecutionSuccess extends ToolExecutionResult {
	applyStatus: ApplyStatus.Applied;
	returnMsg?: ChatUserMessage;
}

// 工具执行失败结果
export interface ToolExecutionFailure extends ToolExecutionResult {
	applyStatus: ApplyStatus.Failed;
	error: string;
}

// 工具执行被拒绝结果
export interface ToolExecutionRejected extends ToolExecutionResult {
	applyStatus: ApplyStatus.Rejected;
	returnMsg?: ChatUserMessage;
}

// 工具执行器抽象类
export abstract class ToolExecutor {
	abstract execute(toolArgs: ToolArgs, applyMsgId: string): Promise<ToolExecutionResult>;
	
	// 创建成功结果的工具方法
	protected createSuccessResult(
		type: string,
		applyMsgId: string,
		promptContent: string,
		id?: string
	): ToolExecutionSuccess {
		return {
			type,
			applyMsgId,
			applyStatus: ApplyStatus.Applied,
			returnMsg: {
				role: 'user',
				applyStatus: ApplyStatus.Idle,
				content: null,
				promptContent,
				id: id || uuidv4(),
				mentionables: [],
			}
		};
	}
	
	// 创建失败结果的工具方法
	protected createFailureResult(
		type: string,
		applyMsgId: string,
		error: string
	): ToolExecutionFailure {
		return {
			type,
			applyMsgId,
			applyStatus: ApplyStatus.Failed,
			error,
			returnMsg: {
				role: 'user',
				applyStatus: ApplyStatus.Idle,
				content: null,
				promptContent: `[${type}] 执行失败: ${error}`,
				id: uuidv4(),
				mentionables: [],
			}
		};
	}
}
