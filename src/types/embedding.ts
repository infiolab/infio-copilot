import { LLMModel } from './llm/model'

export type EmbeddingModelId =
  | 'text-embedding-3-small'
  | 'text-embedding-004'
  | 'nomic-embed-text'
  | 'mxbai-embed-large'
  | 'bge-m3'

export type EmbeddingModelOption = {
  id: EmbeddingModelId
  name: string
  model: LLMModel
  dimension: number
}

export type EmbeddingModel = {
  id: string
  dimension: number
  supportsBatch: boolean
  getEmbedding: (text: string) => Promise<number[]>
  getBatchEmbeddings: (texts: string[]) => Promise<number[][]>
}
