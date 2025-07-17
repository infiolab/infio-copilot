import {
	PropsWithChildren,
	createContext,
	useContext,
	useMemo
} from 'react'

import { DiffStrategy } from '../core/diff/DiffStrategy'


const DiffStrategyContext = createContext<() => DiffStrategy | undefined>(null)

export function DiffStrategyProvider({
	getDiffStrategy,
	children,
}: PropsWithChildren<{ getDiffStrategy: () => DiffStrategy | undefined }>) {

	const value = useMemo(() => {
		return getDiffStrategy
	}, [getDiffStrategy])

	return <DiffStrategyContext.Provider value={value}>{children}</DiffStrategyContext.Provider>
}

export function useDiffStrategy() {
	const getDiffStrategy = useContext(DiffStrategyContext)
	if (!getDiffStrategy) {
		throw new Error('DiffStrategyContext is not initialized')
	}
	
	const diffStrategy = getDiffStrategy()
	if (!diffStrategy) {
		throw new Error('DiffStrategy is not available')
	}
	
	return diffStrategy
}
