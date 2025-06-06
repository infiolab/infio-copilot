import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
} from 'react'

import { DBManager } from '../database/database-manager'
import { MobileDatabaseManager } from '../database/mobile-database-manager'
import { CommandManager } from '../database/modules/command/command-manager'
import { VectorManager } from '../database/modules/vector/vector-manager'

type DatabaseContextType = {
	getDatabaseManager: () => Promise<DBManager | MobileDatabaseManager>
	getVectorManager: () => Promise<VectorManager | any>
	getTemplateManager: () => Promise<CommandManager | any>
}

const DatabaseContext = createContext<DatabaseContextType | null>(null)

export function DatabaseProvider({
	children,
	getDatabaseManager,
}: {
	children: React.ReactNode
	getDatabaseManager: () => Promise<DBManager | MobileDatabaseManager>
}) {
	const getVectorManager = useCallback(async () => {
		return (await getDatabaseManager()).getVectorManager()
	}, [getDatabaseManager])

	const getTemplateManager = useCallback(async () => {
		return (await getDatabaseManager()).getCommandManager()
	}, [getDatabaseManager])

	useEffect(() => {
		// start initialization of dbManager in the background
		void getDatabaseManager()
	}, [getDatabaseManager])

	const value = useMemo(() => {
		return { getDatabaseManager, getVectorManager, getTemplateManager }
	}, [getDatabaseManager, getVectorManager, getTemplateManager])

	return (
		<DatabaseContext.Provider value={value}>
			{children}
		</DatabaseContext.Provider>
	)
}

export function useDatabase(): DatabaseContextType {
	const context = useContext(DatabaseContext)
	if (!context) {
		throw new Error('useDatabase must be used within a DatabaseProvider')
	}
	return context
}
