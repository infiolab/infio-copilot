import {
	PropsWithChildren,
	createContext,
	useContext,
	useEffect,
	useMemo,
} from 'react'

import { RAGEngine } from '../core/rag/rag-engine'
import { MobileRAGEngine } from '../core/rag/mobile-rag-engine'

export type RAGContextType = {
	getRAGEngine: () => Promise<RAGEngine | MobileRAGEngine>
}

const RAGContext = createContext<RAGContextType | null>(null)

export function RAGProvider({
	getRAGEngine,
	children,
}: PropsWithChildren<{ getRAGEngine: () => Promise<RAGEngine | MobileRAGEngine> }>) {
	useEffect(() => {
		// start initialization of ragEngine in the background
		void getRAGEngine()
	}, [getRAGEngine])

	const value = useMemo(() => {
		return { getRAGEngine }
	}, [getRAGEngine])

	return <RAGContext.Provider value={value}>{children}</RAGContext.Provider>
}

export function useRAG() {
	const context = useContext(RAGContext)
	if (!context) {
		throw new Error('useRAG must be used within a RAGProvider')
	}
	return context
}
