import { SerializedEditorState } from 'lexical'

import { SelectVector } from '../database/schema'

import { ApplyStatus } from './apply'
import { LLMModel } from './llm/model'
import { ContentPart } from './llm/request'
import { ResponseUsage } from './llm/response'
import { Mentionable, SerializedMentionable } from './mentionable'

export type ChatUserMessage = {
	role: 'user'
	applyStatus: ApplyStatus
	content: SerializedEditorState | null
	promptContent: string | ContentPart[] | null
	id: string
	mentionables: Mentionable[]
	similaritySearchResults?: (Omit<SelectVector, 'embedding'> & {
		similarity: number
	})[]
	fileReadResults?: Array<{ path: string, content: string }>
	websiteReadResults?: Array<{ url: string, content: string }>
}

export type ChatAssistantMessage = {
	role: 'assistant'
	applyStatus: ApplyStatus
	content: string
	reasoningContent: string
	id: string
	isToolResult?: boolean
	metadata?: {
		usage?: ResponseUsage
		model?: LLMModel
	}
}

export type ChatMessage = ChatUserMessage | ChatAssistantMessage

export type SerializedChatUserMessage = {
	role: 'user'
	applyStatus: ApplyStatus
	content: SerializedEditorState | null
	promptContent: string | ContentPart[] | null
	id: string
	mentionables: SerializedMentionable[]
	similaritySearchResults?: (Omit<SelectVector, 'embedding'> & {
		similarity: number
	})[]
	fileReadResults?: Array<{ path: string, content: string }>
	websiteReadResults?: Array<{ url: string, content: string }>
}

export type SerializedChatAssistantMessage = {
	role: 'assistant'
	applyStatus: ApplyStatus
	content: string
	reasoningContent: string
	id: string
	metadata?: {
		usage?: ResponseUsage
		model?: LLMModel
	}
}

export type SerializedChatMessage =
	| SerializedChatUserMessage
	| SerializedChatAssistantMessage

export type ChatConversation = {
	schemaVersion: number
	id: string
	title: string
	createdAt: number
	updatedAt: number
	messages: SerializedChatMessage[]
}
export type ChatConversationMeta = {
	schemaVersion: number
	id: string
	title: string
	createdAt: number
	updatedAt: number
}
