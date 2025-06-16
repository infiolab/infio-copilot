import { X } from 'lucide-react'
import { PropsWithChildren } from 'react'

import {
	Mentionable,
	MentionableBlock,
	MentionableCurrentFile,
	MentionableFile,
	MentionableFolder,
	MentionableImage,
	MentionableUrl,
	MentionableVault,
} from '../../../types/mentionable'

import { getMentionableIcon } from './utils/get-metionable-icon'

function BadgeBase({
	children,
	onDelete,
	onClick,
	isFocused,
}: PropsWithChildren<{
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}>) {
	return (
		<div
			className={`infio-chat-user-input-file-badge ${isFocused ? 'infio-chat-user-input-file-badge-focused' : ''}`}
			onClick={onClick}
		>
			{children}
			<div
				className="infio-chat-user-input-file-badge-delete"
				onClick={(evt) => {
					evt.stopPropagation()
					onDelete()
				}}
			>
				<X size={16} />
			</div>
		</div>
	)
}

function FileBadge({
	mentionable,
	onDelete,
	onClick,
	isFocused,
}: {
	mentionable: MentionableFile
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}) {
	const Icon = getMentionableIcon(mentionable)
	return (
		<BadgeBase onDelete={onDelete} onClick={onClick} isFocused={isFocused}>
			<div className="infio-chat-user-input-file-badge-name">
				{Icon && (
					<Icon
						size={10}
						className="infio-chat-user-input-file-badge-name-icon"
					/>
				)}
				<span>{mentionable.file?.name ?? 'Unknown file'}</span>
			</div>
		</BadgeBase>
	)
}

function FolderBadge({
	mentionable,
	onDelete,
	onClick,
	isFocused,
}: {
	mentionable: MentionableFolder
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}) {
	const Icon = getMentionableIcon(mentionable)
	return (
		<BadgeBase onDelete={onDelete} onClick={onClick} isFocused={isFocused}>
			<div className="infio-chat-user-input-file-badge-name">
				{Icon && (
					<Icon
						size={10}
						className="infio-chat-user-input-file-badge-name-icon"
					/>
				)}
				<span>{mentionable.folder?.name ?? 'Unknown folder'}</span>
			</div>
		</BadgeBase>
	)
}

function VaultBadge({
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	mentionable,
	onDelete,
	onClick,
	isFocused,
}: {
	mentionable: MentionableVault
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}) {
	const Icon = getMentionableIcon(mentionable)
	return (
		<BadgeBase onDelete={onDelete} onClick={onClick} isFocused={isFocused}>
			{/* TODO: Update style */}
			<div className="infio-chat-user-input-file-badge-name">
				{Icon && (
					<Icon
						size={10}
						className="infio-chat-user-input-file-badge-name-icon"
					/>
				)}
				<span>Vault</span>
			</div>
		</BadgeBase>
	)
}

function CurrentFileBadge({
	mentionable,
	onDelete,
	onClick,
	isFocused,
}: {
	mentionable: MentionableCurrentFile
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}) {
	const Icon = getMentionableIcon(mentionable)
	return mentionable.file ? (
		<BadgeBase onDelete={onDelete} onClick={onClick} isFocused={isFocused}>
			<div className="infio-chat-user-input-file-badge-name">
				{Icon && (
					<Icon
						size={10}
						className="infio-chat-user-input-file-badge-name-icon"
					/>
				)}
				<span>{mentionable.file?.name ?? 'Current file'}</span>
			</div>
			<div className="infio-chat-user-input-file-badge-name-block-suffix">
				{' (Current file)'}
			</div>
		</BadgeBase>
	) : null
}

function BlockBadge({
	mentionable,
	onDelete,
	onClick,
	isFocused,
}: {
	mentionable: MentionableBlock
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}) {
	const Icon = getMentionableIcon(mentionable)
	return (
		<BadgeBase onDelete={onDelete} onClick={onClick} isFocused={isFocused}>
			<div className="infio-chat-user-input-file-badge-name-block-name">
				{Icon && (
					<Icon
						size={10}
						className="infio-chat-user-input-file-badge-name-block-name-icon"
					/>
				)}
				<span>{mentionable.file?.name ?? 'Unknown file'}</span>
			</div>
			<div className="infio-chat-user-input-file-badge-name-block-suffix">
				{` (${mentionable.startLine}:${mentionable.endLine})`}
			</div>
		</BadgeBase>
	)
}

function UrlBadge({
	mentionable,
	onDelete,
	onClick,
	isFocused,
}: {
	mentionable: MentionableUrl
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}) {
	const Icon = getMentionableIcon(mentionable)
	return (
		<BadgeBase onDelete={onDelete} onClick={onClick} isFocused={isFocused}>
			<div className="infio-chat-user-input-file-badge-name">
				{Icon && (
					<Icon
						size={10}
						className="infio-chat-user-input-file-badge-name-icon"
					/>
				)}
				<span>{mentionable.url}</span>
			</div>
		</BadgeBase>
	)
}

function ImageBadge({
	mentionable,
	onDelete,
	onClick,
	isFocused,
}: {
	mentionable: MentionableImage
	onDelete: () => void
	onClick: () => void
	isFocused: boolean
}) {
	const Icon = getMentionableIcon(mentionable)
	return (
		<BadgeBase onDelete={onDelete} onClick={onClick} isFocused={isFocused}>
			<div className="infio-chat-user-input-file-badge-name">
				{Icon && (
					<Icon
						size={10}
						className="infio-chat-user-input-file-badge-name-icon"
					/>
				)}
				<span>{mentionable.name}</span>
			</div>
		</BadgeBase>
	)
}

export default function MentionableBadge({
	mentionable,
	onDelete,
	onClick,
	isFocused = false,
}: {
	mentionable: Mentionable
	onDelete: () => void
	onClick: () => void
	isFocused?: boolean
}) {
	switch (mentionable.type) {
		case 'file':
			return (
				<FileBadge
					mentionable={mentionable}
					onDelete={onDelete}
					onClick={onClick}
					isFocused={isFocused}
				/>
			)
		case 'folder':
			return (
				<FolderBadge
					mentionable={mentionable}
					onDelete={onDelete}
					onClick={onClick}
					isFocused={isFocused}
				/>
			)
		case 'vault':
			return (
				<VaultBadge
					mentionable={mentionable}
					onDelete={onDelete}
					onClick={onClick}
					isFocused={isFocused}
				/>
			)
		case 'current-file':
			return (
				<CurrentFileBadge
					mentionable={mentionable}
					onDelete={onDelete}
					onClick={onClick}
					isFocused={isFocused}
				/>
			)
		case 'block':
			return (
				<BlockBadge
					mentionable={mentionable}
					onDelete={onDelete}
					onClick={onClick}
					isFocused={isFocused}
				/>
			)
		case 'url':
			return (
				<UrlBadge
					mentionable={mentionable}
					onDelete={onDelete}
					onClick={onClick}
					isFocused={isFocused}
				/>
			)
		case 'image':
			return (
				<ImageBadge
					mentionable={mentionable}
					onDelete={onDelete}
					onClick={onClick}
					isFocused={isFocused}
				/>
			)
	}
}
