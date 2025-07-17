import { View, WorkspaceLeaf } from 'obsidian'
import { Root, createRoot } from 'react-dom/client'

import ApplyViewRoot from './components/apply-view/ApplyViewRoot'
// import DiffViewRoot from './components/apply-view/DiffViewRoot'
import { APPLY_VIEW_TYPE } from './constants'
import { AppProvider } from './contexts/AppContext'
import { ApplyEditManagerProvider } from './contexts/ApplyEditManagerContext'
import InfioPlugin from './main'

export type ApplyViewState = {
	file: string
	oldContent: string
	newContent: string
	editId?: string // 编辑日志ID，用于ApplyEditManager
	onClose: (applied: boolean) => void
}

export class ApplyView extends View {
	private root: Root | null = null

	private state: ApplyViewState | null = null

	constructor(leaf: WorkspaceLeaf, private plugin: InfioPlugin) {
		super(leaf)
	}

	getViewType() {
		return APPLY_VIEW_TYPE
	}

	getDisplayText() {
		return `Applying: ${this.state?.file ?? ''}`
	}

	getState() {
		return this.state
	}

	async setState(state: ApplyViewState) {
		this.state = state
		// Should render here because onOpen is called before setState
		this.render()
	}

	async onOpen() {
		this.root = createRoot(this.containerEl)
	}

	async onClose() {
		this.root?.unmount()
	}

	async render() {
		if (!this.root || !this.state) return
		this.root.render(
			<AppProvider app={this.app}>
				<ApplyEditManagerProvider getApplyEditManager={() => this.plugin.applyEditManager}>
					<ApplyViewRoot state={this.state} close={() => this.leaf.detach()} />
				</ApplyEditManagerProvider>
			</AppProvider>,
		)
	}
}
