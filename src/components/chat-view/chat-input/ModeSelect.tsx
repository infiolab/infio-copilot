import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { useSettings } from '../../../contexts/SettingsContext'
import { useCustomModes } from '../../../hooks/use-custom-mode'
import { getIconComponent } from '../../../hooks/use-icon-selector'
import { defaultModes } from '../../../utils/modes'
import { onEnt } from '../../../utils/web-search'

export function ModeSelect() {
	const { settings, setSettings } = useSettings()
	const [isOpen, setIsOpen] = useState(false)
	const [mode, setMode] = useState(settings.mode)

	const { customModeList, getEffectiveBuiltinMode } = useCustomModes()

	const allModes = useMemo(() => {
		// 获取有效的内置模式（包含覆盖配置）
		const effectiveBuiltinModes = defaultModes.map(mode => {
			const effectiveMode = getEffectiveBuiltinMode(mode.slug)
			return effectiveMode
		}).filter(mode => mode && mode.enabled !== false) // 过滤掉禁用的模式

		// 过滤自定义模式，只保留启用的模式
		const filteredCustomModes = customModeList.filter(mode => mode.enabled !== false)
		return [...effectiveBuiltinModes, ...filteredCustomModes]
	}, [customModeList, getEffectiveBuiltinMode])

	useEffect(() => {
		onEnt(`switch_mode/${settings.mode}`)
		setMode(settings.mode)
	}, [settings.mode])

	// 为默认模式定义快捷键提示
	const getShortcutText = (slug: string) => {
		switch (slug) {
			case 'write':
				return 'Ctrl+Shift+.'
			case 'ask':
				return 'Ctrl+Shift+,'
			case 'research':
				return 'Ctrl+Shift+/'
			default:
				return null
		}
	}

	// 为模式获取图标
	const getModeIcon = (slug: string) => {
		const mode = allModes.find(m => m.slug === slug)
		if (!mode?.icon) {
			return null
		}
		const IconComponent = getIconComponent(mode.icon)
		return <IconComponent size={14} />
	}


	return (
		<>
			<DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
				<DropdownMenu.Trigger className="infio-chat-input-mode-select">
					<span className="infio-mode-icon">{getModeIcon(mode)}</span>
					<div className="infio-chat-input-mode-select__model-name">
						{allModes.find((m) => m.slug === mode)?.name}
					</div>
					<div className="infio-chat-input-mode-select__icon">
						{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
					</div>
				</DropdownMenu.Trigger>

				<DropdownMenu.Portal>
					<DropdownMenu.Content
						className="infio-popover infio-mode-select-content">
						<ul>
							{allModes.map((mode) => {
								const shortcut = getShortcutText(mode.slug)
								const icon = getModeIcon(mode.slug)

								return (
									<DropdownMenu.Item
										key={mode.slug}
										onSelect={() => {
											setMode(mode.slug)
											setSettings({
												...settings,
												mode: mode.slug,
											})
										}}
										asChild
									>
										<li className="infio-mode-item">
											<div className="infio-mode-left">
												{icon && (
													<span className="infio-mode-icon">{icon}</span>
												)}
												<span className="infio-mode-name">{mode.name}</span>
											</div>
											{shortcut && (
												<span className="infio-mode-shortcut">{shortcut}</span>
											)}
										</li>
									</DropdownMenu.Item>
								)
							})}
						</ul>
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
			<style >{`
				button.infio-chat-input-mode-select {
					background-color: var(--background-modifier-hover);
					box-shadow: none;
					border: 1;
					padding: var(--size-4-1) var(--size-4-2);
					font-size: var(--font-smallest);
					font-weight: var(--font-medium);
					color: var(--text-muted);
					display: flex;
					justify-content: flex-start;
					align-items: center;
					cursor: pointer;
					height: auto;
					max-width: 100%;
					gap: var(--size-2-2);
					border-radius: var(--radius-l);
					transition: all 0.15s ease-in-out;

					&:hover {
						color: var(--text-normal);
						background-color: var(--background-modifier-hover);
					}

					.infio-chat-input-mode-select__mode-icon {
						flex-shrink: 0;
						display: flex;
						margin-top: var(--size-4-1);
						align-items: center;
						justify-content: center;
						color: var(--text-accent);
					}

					.infio-chat-input-mode-select__model-name {
						flex-shrink: 1;
						overflow: hidden;
						text-overflow: ellipsis;
						white-space: nowrap;
						flex-grow: 1;
					}

					.infio-chat-input-mode-select__icon {
						flex-shrink: 0;
						display: flex;
						align-items: center;
						justify-content: center;
						margin-left: auto;
					}
			 }

			 .infio-mode-select-content {
				min-width: auto !important;
				width: fit-content !important;
				max-width: 200px;
			 }

			 .infio-mode-item {
				display: flex;
				justify-content: space-between;
				align-items: center;
				width: 100%;
				padding: var(--size-4-2) var(--size-4-2);
				white-space: nowrap;
			 }

			 .infio-mode-left {
				display: flex;
				align-items: center;
				gap: var(--size-2-2);
			 }

			 .infio-mode-icon {
				display: flex;
				align-items: center;
				justify-content: center;
				color: var(--text-accent);
				flex-shrink: 0;
			 }

			 .infio-mode-name {
				flex-shrink: 0;
			 }

			 .infio-mode-shortcut {
				font-size: var(--font-smallest);
				color: var(--text-muted);
				background-color: var(--background-modifier-border);
				padding: var(--size-2-1) var(--size-2-2);
				border-radius: var(--radius-s);
				font-family: var(--font-monospace);
				flex-shrink: 0;
			 }
			`}</style>
		</>
	)
}
