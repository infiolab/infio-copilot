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
	return (
		<ApplyEditManagerContext.Provider value={getApplyEditManager}>
			{children}
		</ApplyEditManagerContext.Provider>
	)
}

export const useApplyEditManager = () => {
	const getApplyEditManager = useContext(ApplyEditManagerContext)

	if (!getApplyEditManager) {
		throw new Error('ApplyEditManagerContext is not initialized')
	}

	const result = getApplyEditManager()
	// Return null if applyEditManager is not available instead of throwing error
	// This maintains backward compatibility with existing code
	return result
} 
