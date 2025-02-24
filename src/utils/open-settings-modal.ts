import { App } from 'obsidian'

import { OpenSettingsModal } from '../open-settings-modal'

export function openSettingsModalWithError(app: App, errorMessage: string) {
	new OpenSettingsModal(app, errorMessage, () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const setting = (app as any).setting
		setting.open()
		setting.openTabById('infio-copilot')
	}).open()
}
