import React, { useEffect, useState } from "react";

import { t } from '../../lang/helpers';

export type DropdownComponentProps = {
	name: string;
	description?: string;
	options: string[];
	value: string;
	onChange: (value: string) => void;
}

export const DropdownComponent: React.FC<DropdownComponentProps> = ({
	name,
	description,
	options,
	value,
	onChange,
}) => (
	<div className="infio-llm-setting-item">
		<div className="infio-llm-setting-item-name">{name}</div>
		{description && <div className="infio-llm-setting-item-description">{description}</div>}
		<select
			value={value}
			onChange={(e) => onChange(e.target.value)}
			className="infio-llm-setting-item-control, infio-llm-setting-model-id"
		>
			{options.map((option) => (
				<option key={option} value={option}>
					{option}
				</option>
			))}
		</select>
	</div>
);

export type TextComponentProps = {
	name?: string;
	description?: string;
	placeholder: string;
	value: string;
	type?: string;
	onChange: (value: string) => void;
}

export const TextComponent: React.FC<TextComponentProps> = ({
	name,
	description,
	placeholder,
	value,
	type = "text",
	onChange,
}) => {
	const [localValue, setLocalValue] = useState(value);

	// Update local value when prop value changes (e.g., provider change)
	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setLocalValue(e.target.value);
	};

	const handleBlur = () => {
		if (localValue !== value) {
			onChange(localValue);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.currentTarget.blur();
		}
	};

	return (
		<div className="infio-llm-setting-item">
			<div className="infio-llm-setting-item-name">{name}</div>
			{description && <div className="infio-llm-setting-item-description">{description}</div>}
			<input
				type={type}
				className="infio-llm-setting-item-control"
				placeholder={placeholder}
				value={localValue}
				onChange={handleChange}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
			/>
		</div>
	);
};

export type ToggleComponentProps = {
	name: string;
	description?: string;
	value: boolean;
	onChange: (value: boolean) => void;
	disabled?: boolean;
}

export const ToggleComponent: React.FC<ToggleComponentProps> = ({
	name,
	description,
	value,
	onChange,
	disabled = false,
}) => (
	<div className="infio-llm-setting-item">
		<div className="infio-toggle-setting-section">
			<div className="infio-toggle-info">
				<div className="infio-llm-setting-item-name">{name}</div>
				{description && <div className="infio-llm-setting-item-description">{description}</div>}
			</div>
			<label className={`infio-toggle-switch ${disabled ? "disabled" : ""}`}>
				<input
					type="checkbox"
					checked={value}
					onChange={(e) => onChange(e.target.checked)}
					disabled={disabled}
				/>
				<span className="slider"></span>
			</label>
		</div>

		<style>{`
			.infio-toggle-setting-section {
				display: flex;
				align-items: center;
				justify-content: space-between;
				width: 100%;
				gap: var(--size-4-2);
			}

			.infio-toggle-info {
				flex: 1;
				min-width: 0;
			}

			/* 开关样式 */
			.infio-toggle-switch {
				position: relative;
				display: inline-block;
				width: 44px;
				height: 24px;
				cursor: pointer;
				flex-shrink: 0;
			}

			.infio-toggle-switch.disabled {
				cursor: not-allowed;
				opacity: 0.6;
			}

			.infio-toggle-switch input {
				opacity: 0;
				width: 0;
				height: 0;
			}

			.infio-toggle-switch .slider {
				position: absolute;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background-color: var(--background-modifier-border);
				transition: all 0.2s ease-in-out;
				border-radius: 24px;
				border: 1px solid var(--background-modifier-border-hover);
			}

			.infio-toggle-switch .slider:before {
				position: absolute;
				content: "";
				height: 18px;
				width: 18px;
				left: 2px;
				bottom: 2px;
				background-color: var(--text-on-accent);
				transition: all 0.2s ease-in-out;
				border-radius: 50%;
				box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
			}

			.infio-toggle-switch input:checked + .slider {
				background-color: var(--interactive-accent);
				border-color: var(--interactive-accent);
			}

			.infio-toggle-switch input:checked + .slider:before {
				transform: translateX(20px);
				background-color: white;
			}

			.infio-toggle-switch:not(.disabled):hover .slider {
				box-shadow: 0 0 0 2px var(--interactive-accent-hover);
			}

			.infio-toggle-switch input:focus + .slider {
				box-shadow: 0 0 0 2px var(--interactive-accent-hover);
			}

			.infio-toggle-switch input:disabled + .slider {
				background-color: var(--background-modifier-border);
				cursor: not-allowed;
			}

			.infio-toggle-switch input:disabled + .slider:before {
				background-color: var(--text-faint);
			}

			/* 深色模式适配 */
			.theme-dark .infio-toggle-switch .slider:before {
				background-color: var(--text-normal);
			}

			.theme-dark .infio-toggle-switch input:checked + .slider:before {
				background-color: white;
			}

			.theme-dark .infio-toggle-switch input:disabled + .slider:before {
				background-color: var(--text-faint);
			}
		`}</style>
	</div>
);

export type ApiKeyComponentProps = {
	name: React.ReactNode;
	description?: React.ReactNode;
	placeholder: string;
	value: string;
	onChange: (value: string) => void;
	onTest?: () => Promise<void>;
}

export const ApiKeyComponent: React.FC<ApiKeyComponentProps> = ({
	name,
	description,
	placeholder,
	value,
	onChange,
	onTest,
}) => {
	const [localValue, setLocalValue] = useState(value);
	const [isVisible, setIsVisible] = useState(false);
	const [isTestingConnection, setIsTestingConnection] = useState(false);
	const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

	// Update local value when prop value changes (e.g., provider change)
	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setLocalValue(e.target.value);
		// Clear test result when user changes the key
		setTestResult(null);
	};

	const handleBlur = () => {
		if (localValue !== value) {
			onChange(localValue);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.currentTarget.blur();
		}
	};

	const toggleVisibility = () => {
		setIsVisible(!isVisible);
	};

	const handleTest = async () => {
		if (!onTest || !localValue.trim()) return;
		
		setIsTestingConnection(true);
		setTestResult(null);
		
		try {
			await onTest();
			setTestResult('success');
		} catch (error) {
			setTestResult('error');
		} finally {
			setIsTestingConnection(false);
		}
	};

	return (
		<div className="infio-api-key-setting-item">
			<div className="infio-api-key-info">
				<div className="infio-api-key-name">{name}</div>
				{description && <div className="infio-api-key-description">{description}</div>}
			</div>
			<div className="infio-api-key-control-container">
				<div className="infio-api-key-input-wrapper">
					<input
						type={isVisible ? "text" : "password"}
						className="infio-api-key-input"
						placeholder={placeholder}
						value={localValue}
						onChange={handleChange}
						onBlur={handleBlur}
						onKeyDown={handleKeyDown}
					/>
					<button
						type="button"
						className="infio-api-key-toggle"
						onClick={toggleVisibility}
						title={isVisible ? t("settings.ModelProvider.testConnection.hideApiKey") : t("settings.ModelProvider.testConnection.showApiKey")}
					>
						{isVisible ? (
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
								<line x1="1" y1="1" x2="23" y2="23"></line>
							</svg>
						) : (
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
								<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
								<circle cx="12" cy="12" r="3"></circle>
							</svg>
						)}
					</button>
				</div>
				
				{onTest && (
					<button
						type="button"
						className={`infio-api-key-test ${isTestingConnection ? 'testing' : ''} ${testResult ? testResult : ''}`}
						onClick={handleTest}
						disabled={isTestingConnection || !localValue.trim()}
						title={t("settings.ModelProvider.testConnection.testConnectionTooltip")}
					>
						{isTestingConnection ? (
							<>
								<div className="loading-spinner"></div>
								<span>{t("settings.ModelProvider.testConnection.testing")}</span>
							</>
						) : testResult === 'success' ? (
							<>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<polyline points="20,6 9,17 4,12"></polyline>
								</svg>
								<span>{t("settings.ModelProvider.testConnection.success")}</span>
							</>
						) : testResult === 'error' ? (
							<>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<circle cx="12" cy="12" r="10"></circle>
									<line x1="15" y1="9" x2="9" y2="15"></line>
									<line x1="9" y1="9" x2="15" y2="15"></line>
								</svg>
								<span>{t("settings.ModelProvider.testConnection.failed")}</span>
							</>
						) : (
							<>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
									<circle cx="12" cy="12" r="1"></circle>
									<path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5z"></path>
									<path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5z"></path>
								</svg>
								<span>{t("settings.ModelProvider.testConnection.test")}</span>
							</>
						)}
					</button>
				)}
			</div>

			<style>{`
				.infio-api-key-setting-item {
					display: flex;
					align-items: flex-start;
					justify-content: space-between;
					gap: var(--size-4-6);
					padding: var(--size-4-3) 0;
					border-bottom: 1px solid var(--background-modifier-border);
				}

				.infio-api-key-info {
					flex: 1;
					min-width: 0;
					max-width: 60%;
				}

				.infio-api-key-name {
					font-size: var(--font-ui-medium);
					font-weight: var(--font-weight-medium);
					color: var(--text-normal);
					margin-bottom: var(--size-2-1);
				}

				.infio-api-key-description {
					font-size: var(--font-ui-small);
					color: var(--text-muted);
					line-height: 1.4;
				}

				.infio-api-key-control-container {
					display: flex;
					align-items: center;
					gap: var(--size-2-3);
					min-width: 300px;
					max-width: 380px;
					flex-shrink: 0;
				}

				.infio-api-key-input-wrapper {
					display: flex;
					align-items: center;
					position: relative;
					flex: 1;
				}

				.infio-api-key-input {
					width: 100%;
					padding: var(--size-2-2) var(--size-4-6) var(--size-2-2) var(--size-4-2);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					background: var(--background-primary);
					color: var(--text-normal);
					font-size: var(--font-ui-small);
					font-family: var(--font-monospace);
					transition: all 0.15s ease-in-out;
				}

				.infio-api-key-input:focus {
					outline: none;
					border-color: var(--interactive-accent);
					box-shadow: 0 0 0 2px var(--interactive-accent-hover);
				}

				.infio-api-key-input::placeholder {
					color: var(--text-faint);
				}

				.infio-api-key-toggle {
					position: absolute;
					right: var(--size-2-2);
					padding: var(--size-2-1);
					border: none;
					background: transparent;
					color: var(--text-muted);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					display: flex;
					align-items: center;
					justify-content: center;
					width: 24px;
					height: 24px;
					border-radius: var(--radius-s);
				}

				.infio-api-key-toggle:hover {
					background: var(--background-modifier-hover);
					color: var(--text-normal);
				}

				.infio-api-key-toggle:active {
					background: var(--background-modifier-active);
				}

				.infio-api-key-test {
					display: flex;
					align-items: center;
					gap: var(--size-2-1);
					padding: var(--size-2-2) var(--size-4-2);
					border: 1px solid var(--background-modifier-border);
					border-radius: var(--radius-s);
					background: var(--background-secondary);
					color: var(--text-normal);
					cursor: pointer;
					transition: all 0.15s ease-in-out;
					font-size: var(--font-ui-small);
					font-weight: var(--font-weight-medium);
					height: 34px;
					flex-shrink: 0;
					white-space: nowrap;
				}

				.infio-api-key-test:hover:not(:disabled) {
					background: var(--background-modifier-hover);
					border-color: var(--background-modifier-border-hover);
				}

				.infio-api-key-test:active:not(:disabled) {
					background: var(--background-modifier-active);
				}

				.infio-api-key-test:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.infio-api-key-test.success {
					border-color: var(--color-green);
					background: var(--color-green);
					color: white;
				}

				.infio-api-key-test.error {
					border-color: var(--color-red);
					background: var(--color-red);
					color: white;
				}

				.infio-api-key-test.testing {
					border-color: var(--interactive-accent);
				}

				.loading-spinner {
					width: 14px;
					height: 14px;
					border: 2px solid var(--background-modifier-border);
					border-top: 2px solid var(--interactive-accent);
					border-radius: 50%;
					animation: spin 1s linear infinite;
				}

				@keyframes spin {
					0% { transform: rotate(0deg); }
					100% { transform: rotate(360deg); }
				}

				/* 响应式设计 */
				@media (max-width: 768px) {
					.infio-api-key-setting-item {
						flex-direction: column;
						align-items: stretch;
						gap: var(--size-4-2);
					}

					.infio-api-key-control-container {
						flex-direction: column;
						align-items: stretch;
						min-width: auto;
						max-width: none;
						gap: var(--size-2-2);
					}

					.infio-api-key-input-wrapper {
						flex: none;
					}

					.infio-api-key-test {
						align-self: flex-start;
					}
				}

				/* 深色模式适配 */
				.theme-dark .infio-api-key-input {
					background: var(--background-primary-alt);
					border-color: var(--background-modifier-border-hover);
				}

				.theme-dark .infio-api-key-toggle:hover {
					background: var(--background-modifier-hover);
				}

				.theme-dark .infio-api-key-test {
					background: var(--background-secondary-alt);
				}

				.theme-dark .infio-api-key-test:hover:not(:disabled) {
					background: var(--background-modifier-hover);
				}
			`}</style>
		</div>
	);
};

export type CustomUrlComponentProps = {
	name: string;
	placeholder: string;
	useCustomUrl: boolean;
	baseUrl: string;
	onToggleCustomUrl: (value: boolean) => void;
	onChangeBaseUrl: (value: string) => void;
}

export const CustomUrlComponent: React.FC<CustomUrlComponentProps> = ({
	name,
	placeholder,
	useCustomUrl,
	baseUrl,
	onToggleCustomUrl,
	onChangeBaseUrl,
}) => {
	const [localValue, setLocalValue] = useState(baseUrl);

	// Update local value when prop value changes (e.g., provider change)
	useEffect(() => {
		setLocalValue(baseUrl);
	}, [baseUrl]);

	const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setLocalValue(e.target.value);
	};

	const handleUrlBlur = () => {
		if (localValue !== baseUrl) {
			onChangeBaseUrl(localValue);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === 'Enter') {
			e.currentTarget.blur();
		}
	};

	return (
		<div className="infio-llm-setting-item">
			<div className="infio-custom-url-toggle-section">
				<div className="infio-custom-url-name">{name}</div>
				<label className="infio-toggle-switch">
					<input
						type="checkbox"
						checked={useCustomUrl}
						onChange={(e) => onToggleCustomUrl(e.target.checked)}
					/>
					<span className="slider"></span>
				</label>
			</div>
			
			{useCustomUrl && (
				<div className="infio-custom-url-input-section">
					<input
						type="text"
						className="infio-llm-setting-item-control"
						placeholder={placeholder}
						value={localValue}
						onChange={handleUrlChange}
						onBlur={handleUrlBlur}
						onKeyDown={handleKeyDown}
					/>
				</div>
			)}

			<style>{`
				.infio-custom-url-toggle-section {
					display: flex;
					align-items: center;
					justify-content: space-between;
					width: 100%;
				}

				.infio-custom-url-name {
					font-size: var(--font-ui-medium);
					font-weight: var(--font-weight-medium);
					color: var(--text-normal);
					margin-bottom: var(--size-2-1);
				}


				.infio-custom-url-input-section {
					margin-top: var(--size-4-2);
				}

				/* 开关样式 */
				.infio-toggle-switch {
					position: relative;
					display: inline-block;
					width: 44px;
					height: 24px;
					cursor: pointer;
				}

				.infio-toggle-switch input {
					opacity: 0;
					width: 0;
					height: 0;
				}

				.slider {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background-color: var(--background-modifier-border);
					transition: all 0.2s ease-in-out;
					border-radius: 24px;
					border: 1px solid var(--background-modifier-border-hover);
				}

				.slider:before {
					position: absolute;
					content: "";
					height: 18px;
					width: 18px;
					left: 2px;
					bottom: 2px;
					background-color: var(--text-on-accent);
					transition: all 0.2s ease-in-out;
					border-radius: 50%;
					box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
				}

				.infio-toggle-switch input:checked + .slider {
					background-color: var(--interactive-accent);
					border-color: var(--interactive-accent);
				}

				.infio-toggle-switch input:checked + .slider:before {
					transform: translateX(20px);
					background-color: white;
				}

				.infio-toggle-switch:hover .slider {
					box-shadow: 0 0 0 2px var(--interactive-accent-hover);
				}

				.infio-toggle-switch input:focus + .slider {
					box-shadow: 0 0 0 2px var(--interactive-accent-hover);
				}

				/* 深色模式适配 */
				.theme-dark .slider:before {
					background-color: var(--text-normal);
				}

				.theme-dark .infio-toggle-switch input:checked + .slider:before {
					background-color: white;
				}
			`}</style>
		</div>
	);
};
