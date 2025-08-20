import { Notice, Plugin } from 'obsidian';

import * as React from 'react';
import { ApiKeyModal } from './ApiKeyModal';
import { ProUpgradeModal } from './ProUpgradeModal';

import { fetchUserPlan, CheckProVersion } from '../../hooks/use-infio';
import { getInfioLogoSvg } from '../../utils/icon';
import type { InfioSettings } from '../../types/settings';

interface PluginInfoSettingsProps {
	pluginVersion: string;
	author: string;
	authorUrl: string;
	plugin: Plugin;
	settings: InfioSettings;
}

export default function PluginInfoSettings({
	pluginVersion,
	author,
	authorUrl,
	plugin,
	settings,
}: PluginInfoSettingsProps) {
	// 检测是否为Pro版本（这里可以根据实际逻辑调整）
	const isPro = true; // 暂时设为false，可以根据实际需求调整
	const [isUpgrading, setIsUpgrading] = React.useState(false);

	// Convert SVG string to data URL for proper display
	const logoDataUrl = `data:image/svg+xml;base64,${btoa(getInfioLogoSvg())}`;

	// 处理升级按钮点击
	const handleUpgrade = async () => {
		if (!plugin) {
			new Notice('无法获取插件实例');
			return;
		}

		if (!settings?.infioProvider?.apiKey) {
			if (plugin?.app) {
				new ApiKeyModal(plugin.app).open();
			} else {
				new Notice('请先在Infio Provider设置中配置 Infio API Key');
			}
			return;
		}

		setIsUpgrading(true);

		try {
			// 检查是否为Pro用户
			const userPlan = await fetchUserPlan(settings.infioProvider.apiKey);
			const isProUser = userPlan.plan?.toLowerCase().startsWith('pro') || false;
			if (!isProUser) {
				if (plugin?.app) {
					new ProUpgradeModal(plugin.app).open();
				} else {
					new Notice('您的账户不是Pro用户, 请先升级到Pro');
				}
				return;
			}

			// 执行升级
			const result = await CheckProVersion(plugin, userPlan.dl_zip || '');

			if (result.success) {
				// 升级成功的提示已经在upgradeToProVersion中处理了
			} else {
				new Notice(`加载失败: ${result.message}`);
			}
		} catch (error) {
			// eslint-disable-next-line no-console
			console.error('升级过程中发生错误:', error);
		} finally {
			setIsUpgrading(false);
		}
	};

	return (
		<div className="plugin-info-container">
			{/* 插件头部区域 */}
			<div className="plugin-header">
				<div className="plugin-brand">
					<div className="plugin-logo-wrapper">
						<img src={logoDataUrl} alt="Infio Logo" className="plugin-logo" />
					</div>
					<div className="plugin-title-info">
						<h1 className="plugin-name">Infio</h1>
						<div className="plugin-badges">
							<span className={`version-type-badge ${isPro ? 'pro' : 'community'}`}>
								{isPro ? 'Pro' : 'community'}
							</span>
							<span className="version-number">v{pluginVersion}</span>
							<button
								className="upgrade-button"
								onClick={handleUpgrade}
								disabled={isUpgrading}
							>
								{isUpgrading ? '加载中...' : '检查更新'}
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* 链接容器 */}
			<div className="plugin-links">
				{author && authorUrl && (
					<a
						href={authorUrl}
						target="_blank"
						rel="noopener noreferrer"
						className="plugin-link"
					>
						<span className="plugin-link-icon">👤</span>
						<span>{author}</span>
					</a>
				)}

				<a
					href="https://github.com/infiolab/infio-copilot"
					target="_blank"
					rel="noopener noreferrer"
					className="plugin-link"
				>
					<span className="plugin-link-icon">📖</span>
					<span>GitHub</span>
				</a>

				<a
					href="https://infio.app/docs"
					target="_blank"
					rel="noopener noreferrer"
					className="plugin-link"
				>
					<span className="plugin-link-icon">📚</span>
					<span>Documentation</span>
				</a>

				<a
					href="https://github.com/infiolab/obsidian-infio-copilot/issues"
					target="_blank"
					rel="noopener noreferrer"
					className="plugin-link"
				>
					<span className="plugin-link-icon">💬</span>
					<span>Feedback</span>
				</a>
			</div>

			<style>
				{`
				/* 插件信息容器样式 */
				.plugin-info-container {
					background: var(--background-primary);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-l);
					padding: var(--size-4-6);
					margin-bottom: var(--size-4-8);
					box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
					transition: box-shadow 0.2s ease;
				}

				.plugin-info-container:hover {
					box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
				}

				/* 插件头部区域 */
				.plugin-header {
					margin-bottom: var(--size-4-6);
				}

				/* 品牌区域 */
				.plugin-brand {
					display: flex;
					align-items: center;
					gap: var(--size-4-3);
				}

				/* Logo包装器 */
				.plugin-logo-wrapper {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 60px;
					height: 60px;
					border-radius: var(--radius-m);
					padding: var(--size-2-2);
				}

				/* 插件logo */
				.plugin-logo {
					width: 60px;
					height: 60px;
					flex-shrink: 0;
				}

				/* 标题信息区域 */
				.plugin-title-info {
					display: flex;
					flex-direction: column;
					gap: var(--size-2-2);
				}

				/* 插件名称 */
				.plugin-name {
					font-size: 1.75rem;
					font-weight: 700;
					color: var(--text-normal);
					margin: 0;
					line-height: 1.2;
					letter-spacing: -0.01em;
				}

				/* 徽章容器 */
				.plugin-badges {
					display: flex;
					align-items: center;
					gap: var(--size-2-3);
				}

				/* 版本类型标识 */
				.version-type-badge {
					padding: var(--size-2-1) var(--size-2-3);
					border-radius: var(--radius-s);
					font-size: 11px;
					font-weight: 700;
					text-transform: uppercase;
					letter-spacing: 0.8px;
					white-space: nowrap;
				}

				.version-type-badge.pro {
					background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
					color: var(--text-on-accent);
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				}

				.version-type-badge.community {
					background: var(--background-modifier-border);
					color: var(--text-muted);
					font-weight: 600;
				}

				/* 版本号 */
				.version-number {
					color: var(--text-muted);
					font-size: var(--font-ui-medium);
					font-weight: 500;
					background: var(--background-secondary);
					padding: var(--size-2-1) var(--size-2-2);
					border-radius: var(--radius-s);
					border: 1px solid var(--background-modifier-border);
				}

				/* 链接容器 */
				.plugin-links {
					display: flex;
					gap: var(--size-4-2);
					flex-wrap: wrap;
				}

				/* 链接样式 */
				.plugin-link {
					color: var(--text-accent);
					text-decoration: none;
					font-size: var(--font-ui-small);
					padding: var(--size-2-1) var(--size-2-3);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					transition: all 0.2s ease;
					display: flex;
					align-items: center;
					gap: var(--size-2-1);
				}

				.plugin-link:hover {
					background: var(--background-modifier-hover);
					border-color: var(--background-modifier-border-hover);
				}

				/* 响应式设计 */
				@media (max-width: 768px) {
					.plugin-title-row {
						flex-direction: column;
						align-items: flex-start;
						gap: var(--size-2-3);
					}

					.plugin-logo {
						width: 32px;
						height: 32px;
					}

					.plugin-name {
						font-size: 1.5rem;
					}

					.plugin-badges {
						justify-content: center;
					}

					.plugin-links {
						grid-template-columns: 1fr;
						gap: var(--size-2-2);
					}

					.plugin-link {
						justify-content: center;
						padding: var(--size-2-3);
					}
				}
				/* 升级按钮 */
				.upgrade-button {
					background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
					color: var(--text-on-accent);
					border: none;
					padding: var(--size-2-1) var(--size-2-3);
					border-radius: var(--radius-s);
					font-size: var(--font-ui-small);
					font-weight: 600;
					cursor: pointer;
					transition: all 0.2s ease;
					white-space: nowrap;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				}

				.upgrade-button:hover:not(:disabled) {
					background: linear-gradient(135deg, var(--interactive-accent-hover), var(--interactive-accent));
					transform: translateY(-1px);
					box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
				}

				.upgrade-button:active:not(:disabled) {
					transform: translateY(0);
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				}

				.upgrade-button:disabled {
					opacity: 0.6;
					cursor: not-allowed;
					transform: none;
					box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
				}

				/* 深色模式适配 */
				.theme-dark .plugin-info-container {
					background: var(--background-primary-alt);
					border-color: var(--background-modifier-border-hover);
				}
				`}
			</style>
		</div>
	);
} 
