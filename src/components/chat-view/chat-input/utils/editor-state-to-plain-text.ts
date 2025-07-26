import { SerializedEditorState, SerializedLexicalNode } from 'lexical'

import { COMMAND_NODE_TYPE, SerializedCommandNode } from '../plugins/command/CommandNode'

export function editorStateToPlainText(
  editorState: SerializedEditorState,
): string {
  return lexicalNodeToPlainText(editorState.root)
}

export function lexicalNodeToPlainText(node: SerializedLexicalNode): string {
  if ('children' in node) {
    // Process children recursively and join their results
    return (node.children as SerializedLexicalNode[])
      .map(lexicalNodeToPlainText)
      .join('')
  } else if (node.type === 'linebreak') {
    return '\n'
  } else if (node.type === COMMAND_NODE_TYPE) {
    // Handle CommandNode - return the actual command content, not the command name
		const commandNode = node as SerializedCommandNode
		console.log('🔍 CommandNode处理:', commandNode.commandName, '内容:', commandNode.commandContent)
    return commandNode.commandContent || `/${commandNode.commandName}`
  } else if ('text' in node && typeof node.text === 'string') {
    return node.text
  }
  return ''
}
