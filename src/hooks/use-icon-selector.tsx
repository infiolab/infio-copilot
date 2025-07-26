import {
	// Default icon set for commands
	Battery,
	Bluetooth,
	BookOpen,
	Brain,
	Briefcase,
	Calendar,
	Camera,
	Check,
	CheckSquare,
	Clock,
	Code,
	Command,
	Database,
	Edit,
	FileText,
	Globe,
	Headphones,
	Heart,
	Image,
	Key,
	Languages,
	Lightbulb,
	Lock,
	Mail,
	MapPin,
	MessageSquare,
	Mic,
	Music,
	Phone,
	Server,
	Settings,
	Shield,
	SquareSlash,
	Star,
	Target,
	Video,
	Volume2,
	Wand,
	Wifi,
	Zap
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

// Default icon options for commands
export const DEFAULT_COMMAND_ICONS = [
	{ name: 'square-slash', icon: SquareSlash, label: 'square-slash' },
	{ name: 'command', icon: Command, label: '命令' },
	{ name: 'check', icon: Check, label: '检查' },
	{ name: 'wand', icon: Wand, label: '魔法棒' },
	{ name: 'languages', icon: Languages, label: '语言' },
	{ name: 'settings', icon: Settings, label: '设置' },
	{ name: 'file-text', icon: FileText, label: '文档' },
	{ name: 'edit', icon: Edit, label: '编辑' },
	{ name: 'message-square', icon: MessageSquare, label: '消息' },
	{ name: 'zap', icon: Zap, label: '快速' },
	{ name: 'book-open', icon: BookOpen, label: '阅读' },
	{ name: 'calendar', icon: Calendar, label: '日历' },
	{ name: 'check-square', icon: CheckSquare, label: '任务' },
	{ name: 'globe', icon: Globe, label: '网络' },
	{ name: 'code', icon: Code, label: '代码' },
	{ name: 'brain', icon: Brain, label: '智能' },
	{ name: 'lightbulb', icon: Lightbulb, label: '想法' },
	{ name: 'target', icon: Target, label: '目标' },
	{ name: 'clock', icon: Clock, label: '时间' },
	{ name: 'star', icon: Star, label: '收藏' },
	{ name: 'heart', icon: Heart, label: '喜欢' },
	{ name: 'briefcase', icon: Briefcase, label: '工作' },
	{ name: 'image', icon: Image, label: '图片' },
	{ name: 'music', icon: Music, label: '音乐' },
	{ name: 'video', icon: Video, label: '视频' },
	{ name: 'mail', icon: Mail, label: '邮件' },
	{ name: 'phone', icon: Phone, label: '电话' },
	{ name: 'map-pin', icon: MapPin, label: '位置' },
	{ name: 'camera', icon: Camera, label: '相机' },
	{ name: 'shield', icon: Shield, label: '安全' },
	{ name: 'lock', icon: Lock, label: '锁定' },
	{ name: 'key', icon: Key, label: '密钥' },
	{ name: 'database', icon: Database, label: '数据库' },
	{ name: 'server', icon: Server, label: '服务器' },
	{ name: 'wifi', icon: Wifi, label: 'WiFi' },
	{ name: 'bluetooth', icon: Bluetooth, label: '蓝牙' },
	{ name: 'battery', icon: Battery, label: '电池' },
	{ name: 'volume-2', icon: Volume2, label: '音量' },
	{ name: 'headphones', icon: Headphones, label: '耳机' },
	{ name: 'mic', icon: Mic, label: '麦克风' }
]

// Helper function to get icon component
export const getIconComponent = (iconName?: string) => {
	const iconData = DEFAULT_COMMAND_ICONS.find(icon => icon.name === iconName)
	return iconData?.icon || Command
}

// Icon Selector Component
export interface IconSelectorProps {
	selectedIcon?: string
	onIconSelect: (iconName: string) => void
	size?: number
	className?: string
}

export const IconSelector: React.FC<IconSelectorProps> = ({ selectedIcon, onIconSelect, className, size = 14 }) => {
	const [isOpen, setIsOpen] = useState(false)
	const dropdownRef = useRef<HTMLDivElement>(null)
	
	const selectedIconData = DEFAULT_COMMAND_ICONS.find(icon => icon.name === selectedIcon)
	const SelectedIconComponent = selectedIconData?.icon || Command

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (dropdownRef.current && event.target && dropdownRef.current.contains(event.target as Node) === false) {
				setIsOpen(false)
			}
		}

		if (isOpen) {
			document.addEventListener('mousedown', handleClickOutside)
		}

		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [isOpen])

	return (
		<div className={`infio-icon-selector ${className || ''}`} ref={dropdownRef}>
			<button
				type="button"
				className="infio-icon-selector-button"
				onClick={() => setIsOpen(!isOpen)}
			>
				<SelectedIconComponent size={size} />
			</button>
			
			{isOpen && (
				<div className="infio-icon-selector-dropdown">
					<div className="infio-icon-selector-grid">
						{DEFAULT_COMMAND_ICONS.map((iconData) => {
							const IconComponent = iconData.icon
							return (
								<button
									key={iconData.name}
									type="button"
									className={`infio-icon-selector-option ${selectedIcon === iconData.name ? 'selected' : ''}`}
									onClick={() => {
										onIconSelect(iconData.name)
										setIsOpen(false)
									}}
									title={iconData.label}
								>
									<IconComponent size={size} />
								</button>
							)
						})}
					</div>
				</div>
			)}
		</div>
	)
}

// Hook for using icon selector
export const useIconSelector = (initialIcon: string = 'command') => {
	const [selectedIcon, setSelectedIcon] = useState(initialIcon)

	const resetIcon = () => setSelectedIcon('command')

	return {
		selectedIcon,
		setSelectedIcon,
		resetIcon,
		IconSelectorComponent: IconSelector,
		getIconComponent
	}
} 
