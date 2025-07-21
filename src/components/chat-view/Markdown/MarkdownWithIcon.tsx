import * as Tooltip from '@radix-ui/react-tooltip';
import { Check, CircleCheckBig, CircleHelp, CopyIcon, FilePlus2 } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { useApp } from 'src/contexts/AppContext';

import { t } from '../../../lang/helpers'

import RawMarkdownBlock from './RawMarkdownBlock'

export function CopyButton({ message }: { message: string }) {
	const [copied, setCopied] = useState(false)

	const handleCopy = async () => {
		await navigator.clipboard.writeText(message)
		setCopied(true)
		setTimeout(() => {
			setCopied(false)
		}, 1500)
	}

	return (
		<Tooltip.Provider delayDuration={0}>
			<Tooltip.Root>
				<Tooltip.Trigger asChild>
					<button>
						{copied ? (
							<Check
								size={12}
								className="infio-chat-message-actions-icon--copied"
							/>
						) : (
							<CopyIcon onClick={handleCopy} size={12} />
						)}
					</button>
				</Tooltip.Trigger>
				<Tooltip.Portal>
					<Tooltip.Content className="infio-tooltip-content">
						{t('chat.reactMarkdown.copyMsg') as string}
					</Tooltip.Content>
				</Tooltip.Portal>
			</Tooltip.Root>
		</Tooltip.Provider>
	)
}

export function CreateNewFileButton({ message }: { message: string }) {
	const app = useApp()
	const [created, setCreated] = useState(false)

	const cleanMarkdownTitle = (text: string): string => {
		// 移除所有 # 开头的标题标记
		return text.replace(/^#+\s*/g, '');
	}

	const handleCreate = async () => {
		const firstLine = cleanMarkdownTitle(message.trimStart().split('\n')[0].trim()).replace(/[\\/:]/g, '');
		const filename = firstLine.slice(0, 200) + (firstLine.length > 200 ? '...' : '') || 'untitled';
		await app.vault.create(`/${filename}.md`, message)
		await app.workspace.openLinkText(filename, 'split', true)
		setCreated(true)
		setTimeout(() => {
			setCreated(false)
		}, 1500)
	}
	return (
		<Tooltip.Provider delayDuration={0}>
			<Tooltip.Root>
				<Tooltip.Trigger asChild>
					<button className="infio-markdown-create-button">
						{created ? (
							<Check
								size={12}
								className="infio-chat-message-actions-icon--copied"
							/>
						) : (
							<FilePlus2 onClick={handleCreate} size={12} />
						)}
					</button>
				</Tooltip.Trigger>
				<Tooltip.Portal>
					<Tooltip.Content className="infio-tooltip-content">
						{t('chat.reactMarkdown.createNewNote') as string}
					</Tooltip.Content>
				</Tooltip.Portal>
			</Tooltip.Root>
		</Tooltip.Provider>
	)
}

type IconType = 'ask_followup_question' | 'attempt_completion';

interface MarkdownWithIconsProps {
	markdownContent: string;
	finish: boolean
	className?: string;
	iconName?: IconType;
	iconSize?: number;
	iconClassName?: string;
}

const MarkdownWithIcons = ({
	markdownContent,
	finish,
	className,
	iconName,
	iconSize = 14,
	iconClassName = "infio-markdown-icon"
}: MarkdownWithIconsProps) => {
	// Handle icon rendering directly without string manipulation
	const renderIcon = (): ReactNode => {
		if (!iconName) return null;

		switch (iconName) {
			case 'ask_followup_question':
				return <CircleHelp size={iconSize} className={iconClassName} />;
			case 'attempt_completion':
				return <CircleCheckBig size={iconSize} className={iconClassName} />;
			default:
				return null;
		}
	};

	const renderTitle = (): ReactNode => {
		if (!iconName) return null;

		switch (iconName) {
			case 'ask_followup_question':
				return t('chat.reactMarkdown.askFollowupQuestion');
			case 'attempt_completion':
				return t('chat.reactMarkdown.taskCompletion');
			default:
				return null;
		}
	};

	// Component for markdown content
	return (
		<>
			<div className={`${className}`}>
				<span>{iconName && renderIcon()} {renderTitle()}</span>
				<RawMarkdownBlock
					content={markdownContent}
					className={`${className}`}
				/>
			</div>
			{/* {markdownContent && finish && iconName === "attempt_completion" &&
				<div className="infio-chat-message-actions">
					<CopyButton message={markdownContent} />
					<CreateNewFileButton message={markdownContent} />
				</div>} */}
		</>
	);
};

export default MarkdownWithIcons;
