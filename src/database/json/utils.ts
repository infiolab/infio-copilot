import { App } from 'obsidian'

import { ChatMessage, SerializedChatMessage } from '../../types/chat'
import { Mentionable } from '../../types/mentionable'
import {
	deserializeMentionable,
	serializeMentionable,
} from '../../utils/mentionable'


export const serializeChatMessage = (message: ChatMessage): SerializedChatMessage => {
	switch (message.role) {
		case 'user':
			return {
				role: 'user',
				applyStatus: message.applyStatus,
				content: message.content,
				promptContent: message.promptContent,
				id: message.id,
				mentionables: message.mentionables.map(serializeMentionable),
				similaritySearchResults: message.similaritySearchResults,
			}
		case 'assistant':
			return {
				role: 'assistant',
				applyStatus: message.applyStatus,
				content: message.content,
				reasoningContent: message.reasoningContent,
				id: message.id,
				toolResultContent: message.toolResultContent,
				metadata: message.metadata,
			}
	}
}

export const deserializeChatMessage = (
	message: SerializedChatMessage,
	app: App,
): ChatMessage => {
	switch (message.role) {
		case 'user': {
			return {
				role: 'user',
				applyStatus: message.applyStatus,
				content: message.content,
				promptContent: message.promptContent,
				id: message.id,
				mentionables: message.mentionables
					.map((m) => deserializeMentionable(m, app))
					.filter((m): m is Mentionable => m !== null),
				similaritySearchResults: message.similaritySearchResults,
			}
		}
		case 'assistant':
			return {
				role: 'assistant',
				applyStatus: message.applyStatus,
				content: message.content,
				reasoningContent: message.reasoningContent,
				id: message.id,
				toolResultContent: message.toolResultContent,
				metadata: message.metadata,
			}
	}
}
