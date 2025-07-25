/**
 * CommandNode implementation similar to MentionNode
 * Used to display command names like /commandName in the editor
 */

import {
  $applyNodeReplacement,
  DOMConversionMap,
  DOMConversionOutput,
  DOMExportOutput,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from 'lexical'

export const COMMAND_NODE_TYPE = 'command'
export const COMMAND_NODE_ATTRIBUTE = 'data-lexical-command'
export const COMMAND_NODE_COMMAND_NAME_ATTRIBUTE = 'data-lexical-command-name'
export const COMMAND_NODE_COMMAND_ID_ATTRIBUTE = 'data-lexical-command-id'

export type SerializedCommandNode = Spread<
  {
    commandName: string
    commandId: string
  },
  SerializedTextNode
>

function $convertCommandElement(
  domNode: HTMLElement,
): DOMConversionOutput | null {
  const textContent = domNode.textContent
  const commandName =
    domNode.getAttribute(COMMAND_NODE_COMMAND_NAME_ATTRIBUTE) ??
    domNode.textContent ??
    ''
  const commandId = domNode.getAttribute(COMMAND_NODE_COMMAND_ID_ATTRIBUTE) ?? ''

  if (textContent !== null) {
    const node = $createCommandNode(commandName, commandId)
    return {
      node,
    }
  }

  return null
}

export class CommandNode extends TextNode {
  __commandName: string
  __commandId: string

  static getType(): string {
    return COMMAND_NODE_TYPE
  }

  static clone(node: CommandNode): CommandNode {
    return new CommandNode(node.__commandName, node.__commandId, node.__key)
  }
  
  static importJSON(serializedNode: SerializedCommandNode): CommandNode {
    const node = $createCommandNode(
      serializedNode.commandName,
      serializedNode.commandId,
    )
    node.setTextContent(serializedNode.text)
    node.setFormat(serializedNode.format)
    node.setDetail(serializedNode.detail)
    node.setMode(serializedNode.mode)
    node.setStyle(serializedNode.style)
    return node
  }

  constructor(
    commandName: string,
    commandId: string,
    key?: NodeKey,
  ) {
    super(`/${commandName}`, key)
    this.__commandName = commandName
    this.__commandId = commandId
  }

  exportJSON(): SerializedCommandNode {
    return {
      ...super.exportJSON(),
      commandName: this.__commandName,
      commandId: this.__commandId,
      type: COMMAND_NODE_TYPE,
      version: 1,
    }
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config)
    dom.className = COMMAND_NODE_TYPE
    return dom
  }

  exportDOM(): DOMExportOutput {
    const element = document.createElement('span')
    element.setAttribute(COMMAND_NODE_ATTRIBUTE, 'true')
    element.setAttribute(
      COMMAND_NODE_COMMAND_NAME_ATTRIBUTE,
      this.__commandName,
    )
    element.setAttribute(
      COMMAND_NODE_COMMAND_ID_ATTRIBUTE,
      this.__commandId,
    )
    element.textContent = this.__text
    return { element }
  }

  static importDOM(): DOMConversionMap | null {
    return {
      span: (domNode: HTMLElement) => {
        if (
          !domNode.hasAttribute(COMMAND_NODE_ATTRIBUTE) ||
          !domNode.hasAttribute(COMMAND_NODE_COMMAND_NAME_ATTRIBUTE) ||
          !domNode.hasAttribute(COMMAND_NODE_COMMAND_ID_ATTRIBUTE)
        ) {
          return null
        }
        return {
          conversion: $convertCommandElement,
          priority: 1,
        }
      },
    }
  }

  isTextEntity(): true {
    return true
  }

  canInsertTextBefore(): boolean {
    return false
  }

  canInsertTextAfter(): boolean {
    return false
  }

  getCommandName(): string {
    return this.__commandName
  }

  getCommandId(): string {
    return this.__commandId
  }
}

export function $createCommandNode(
  commandName: string,
  commandId: string,
): CommandNode {
  const commandNode = new CommandNode(commandName, commandId)
  commandNode.setMode('token').toggleDirectionless()
  return $applyNodeReplacement(commandNode)
}

export function $isCommandNode(
  node: LexicalNode | null | undefined,
): node is CommandNode {
  return node instanceof CommandNode
} 
