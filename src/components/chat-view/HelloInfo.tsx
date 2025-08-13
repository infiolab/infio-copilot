import { Box, History, Lightbulb, Search } from 'lucide-react';
import React from 'react';

import { t } from '../../lang/helpers';
import { getInfioLogoSvg } from '../../utils/icon';

interface HelloInfoProps {
	onNavigate: (tab: 'commands' | 'custom-mode' | 'mcp' | 'search' | 'history' | 'insights' | 'workspace') => void;
}

const HelloInfo: React.FC<HelloInfoProps> = ({ onNavigate }) => {
	const navigationItems = [
		{
			label: t('workspace.shortTitle'),
			description: t('workspace.description'),
			icon: <Box size={20} />,
			action: () => onNavigate('workspace'),
		},
		{
			label: t('chat.navigation.history'),
			description: t('chat.navigation.historyDesc'),
			icon: <History size={20} />,
			action: () => onNavigate('history'),
		},
		{
			label: t('chat.navigation.search'),
			description: t('chat.navigation.searchDesc'),
			icon: <Search size={20} />,
			action: () => onNavigate('search'),
		},
		{
			label: t('chat.navigation.insights'),
			description: t('chat.navigation.insightsDesc'),
			icon: <Lightbulb size={20} />,
			action: () => onNavigate('insights'),
		},
		// {
		// 	label: t('chat.navigation.commands'),
		// 	description: t('chat.navigation.commandsDesc'),
		// 	icon: <SquareSlash size={20} />,
		// 	action: () => onNavigate('commands'),
		// },
		// {
		// 	label: t('chat.navigation.customMode'),
		// 	description: t('chat.navigation.customModeDesc'),
		// 	icon: <NotebookPen size={20} />,
		// 	action: () => onNavigate('custom-mode'),
		// },
		// {
		// 	label: t('chat.navigation.mcp'),
		// 	description: t('chat.navigation.mcpDesc'),
		// 	icon: <Server size={20} />,
		// 	action: () => onNavigate('mcp'),
		// }
	];

	// Convert SVG string to data URL for proper display
	const logoDataUrl = `data:image/svg+xml;base64,${btoa(getInfioLogoSvg())}`;

	return (
		<div className="infio-hello-info">
			<div className="infio-hero-section">
				<div className="infio-logo-container">
					<img src={logoDataUrl} alt="Infio Logo" className="infio-logo" />
				</div>
				<div className="infio-hello-title">
					<h3>What can I help you with?</h3>
				</div>
			</div>
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

					.infio-hero-section {
						display: flex;
						flex-direction: column;
						align-items: center;
						gap: var(--size-4-4);
					}

					.infio-logo-container {
						display: flex;
						align-items: center;
						justify-content: center;
					}

					.infio-logo {
						width: 80px;
						height: 80px;
						border-radius: var(--radius-m);
					}

					.infio-hello-title h3 {
						font-size: 1.5rem;
						font-weight: 500;
						color: var(--text-normal);
						margin: 0;
						text-align: center;
					}

					.infio-navigation-cards {
						display: flex;
						flex-direction: column;
						width: 100%;
						max-width: 480px;
						gap: var(--size-2-2);
					}

					.infio-navigation-card {
						display: flex;
						align-items: flex-start;
						gap: var(--size-4-1);
						padding: var(--size-4-2) var(--size-4-2);
						cursor: pointer;
						text-align: left;
						width: 100%;
						transition: all 0.2s ease;
					}

					.infio-navigation-icon {
						display: flex;
						align-items: center;
						justify-content: center;
						width: 18px;
						height: 18px;
						border-radius: var(--radius-s);
						flex-shrink: 0;
						margin-top: var(--size-2-1);
					}

					.infio-navigation-content {
						display: flex;
						flex-direction: column;
						flex-grow: 1;
						padding-top: var(--size-2-1);
					}

					.infio-navigation-description {
						font-size: var(--font-ui-medium);
						color: var(--text-normal);
						margin: 0;
						line-height: 1.4;
					}

				`}
			</style>
		</div>
	);
};

export default HelloInfo;
