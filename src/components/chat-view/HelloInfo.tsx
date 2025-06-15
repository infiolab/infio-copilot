import { NotebookPen, Search, Server, SquareSlash } from 'lucide-react';
import React from 'react';

import { t } from '../../lang/helpers';

interface HelloInfoProps {
	onNavigate: (tab: 'commands' | 'custom-mode' | 'mcp' | 'search') => void;
}

const HelloInfo: React.FC<HelloInfoProps> = ({ onNavigate }) => {
	const navigationItems = [
		{
			label: '语义搜索',
			description: '使用 RAG 在笔记库中进行语义搜索',
			icon: <Search size={20} />,
			action: () => onNavigate('search'),
		},
		{
			label: t('chat.navigation.commands'),
			description: t('chat.navigation.commandsDesc'),
			icon: <SquareSlash size={20} />,
			action: () => onNavigate('commands'),
		},
		{
			label: t('chat.navigation.customMode'),
			description: t('chat.navigation.customModeDesc'),
			icon: <NotebookPen size={20} />,
			action: () => onNavigate('custom-mode'),
		},
		{
			label: t('chat.navigation.mcp'),
			description: t('chat.navigation.mcpDesc'),
			icon: <Server size={20} />,
			action: () => onNavigate('mcp'),
		}
	];

	return (
		<div className="infio-hello-info">
			{/* <div className="infio-hello-title">
				<h3>{t('chat.welcome.title')}</h3>
				<p>{t('chat.welcome.subtitle')}</p>
			</div> */}
			<div className="infio-navigation-cards">
				{navigationItems.map((item, index) => (
					<a
						key={index}
						className="infio-navigation-card"
						onClick={item.action}
					>
						<div className="infio-navigation-icon">
							{item.icon}
						</div>
						<div className="infio-navigation-content">
							<div className="infio-navigation-label">{item.label}</div>
							<div className="infio-navigation-description">{item.description}</div>
						</div>
					</a>
				))}
			</div>
			<style>
				{`
				/*
					* Hello Info and Navigation
					*/
					.infio-hello-info {
						display: flex;
						flex-direction: column;
						align-items: center;
						padding: var(--size-4-8) var(--size-4-4);
						gap: var(--size-4-6);
						text-align: center;
						margin: var(--size-4-4);
					}

					.infio-hello-title h3 {
						font-size: 2rem;
						font-weight: 600;
						color: var(--text-normal);
						margin: 0 0 var(--size-4-3) 0;
						text-align: center;
					}

					.infio-hello-title p {
						font-size: var(--font-ui-medium);
						color: var(--text-muted);
						margin: 0;
						line-height: var(--line-height-normal);
					}

					.infio-navigation-cards {
						display: flex;
						flex-direction: column;
						width: 100%;
						max-width: 480px;
					}

					.infio-navigation-card {
						display: flex;
						align-items: center;
						gap: var(--size-4-4);
						padding: var(--size-4-5) var(--size-4-6);
						cursor: pointer;
						text-align: left;
						width: 100%;
						box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
					}

					.infio-navigation-card:hover {
						background: var(--background-modifier-hover);
						border-color: var(--text-accent);
					}

					.infio-navigation-icon {
						display: flex;
						align-items: center;
						justify-content: center;
						border-radius: var(--radius-m);
						color: var(--text-accent);
						flex-shrink: 0;
					}

					.infio-navigation-content {
						display: flex;
						flex-direction: column;
						gap: var(--size-2-2);
						flex-grow: 1;
					}

					.infio-navigation-label {
						font-size: var(--font-ui-large);
						font-weight: 600;
						color: var(--text-normal);
						margin: 0;
					}

					.infio-navigation-description {
						font-size: var(--font-ui-small);
						color: var(--text-muted);
						margin: 0;
						line-height: 1.5;
					}

				`}
			</style>
		</div>
	);
};

export default HelloInfo;
