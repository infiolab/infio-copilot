import React, { createContext, useContext } from 'react'

import { ApplyEditManager } from '../core/apply/ApplyEditManager'

const ApplyEditManagerContext = createContext<(() => ApplyEditManager | null) | undefined>(undefined)

export const ApplyEditManagerProvider = ({
	children,
	getApplyEditManager,
}: {
	children: React.ReactNode
	getApplyEditManager: () => ApplyEditManager | null
}) => {
	console.log('[ApplyEditManagerProvider] Initializing with getApplyEditManager:', typeof getApplyEditManager)
	
	return (
		<ApplyEditManagerContext.Provider value={getApplyEditManager}>
			{children}
		</ApplyEditManagerContext.Provider>
	)
}

export const useApplyEditManager = () => {
	console.log('[useApplyEditManager] Called')
	
	const getApplyEditManager = useContext(ApplyEditManagerContext)
	console.log('[useApplyEditManager] getApplyEditManager from context:', typeof getApplyEditManager)
	
	if (!getApplyEditManager) {
		console.error('[useApplyEditManager] ApplyEditManagerContext is not initialized')
		throw new Error('ApplyEditManagerContext is not initialized')
	}
	
	console.log('[useApplyEditManager] About to call getApplyEditManager()')
	const result = getApplyEditManager()
	console.log('[useApplyEditManager] getApplyEditManager() returned:', result)
	
	// Return null if applyEditManager is not available instead of throwing error
	// This maintains backward compatibility with existing code
	return result
} 
