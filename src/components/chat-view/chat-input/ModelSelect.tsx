import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import Fuse, { FuseResult } from 'fuse.js'
import { ChevronDown, ChevronUp, Star } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import { useSettings } from '../../../contexts/SettingsContext'
import { t } from '../../../lang/helpers'
import { ApiProvider } from '../../../types/llm/model'
import { GetAllProviders, GetEmbeddingProviders, GetEmbeddingProviderModelIds, GetProviderModelsWithSettings } from "../../../utils/api"

// 优化模型名称显示的函数
const getOptimizedModelName = (modelId: string): string => {
	if (!modelId) return modelId;

	// 限制长度，如果太长则截断并添加省略号
	if (modelId.length > 25) {
		return modelId.substring(0, 22) + '...';
	}

	return modelId;
};

type TextSegment = {
	text: string;
	isHighlighted: boolean;
};

type SearchableItem = {
	id: string;
	html: string | TextSegment[];
	provider?: string;
	isCollected?: boolean;
};

type HighlightedItem = {
	id: string;
	html: TextSegment[];
	provider?: string;
	isCollected?: boolean;
};

// Reuse highlight function from ProviderModelsPicker
const highlight = (fuseSearchResult: Array<FuseResult<SearchableItem>>): HighlightedItem[] => {
	const set = (obj: Record<string, unknown>, path: string, value: TextSegment[]): void => {
		const pathValue = path.split(".")
		let i: number
		let current = obj as Record<string, unknown>

		for (i = 0; i < pathValue.length - 1; i++) {
			const nextValue = current[pathValue[i]]
			if (typeof nextValue === 'object' && nextValue !== null) {
				current = nextValue as Record<string, unknown>
			} else {
				throw new Error(`Invalid path: ${path}`)
			}
		}

		current[pathValue[i]] = value
	}

	const mergeRegions = (regions: [number, number][]): [number, number][] => {
		if (regions.length === 0) return regions
		regions.sort((a, b) => a[0] - b[0])
		const merged: [number, number][] = [regions[0]]
		for (let i = 1; i < regions.length; i++) {
			const last = merged[merged.length - 1]
			const current = regions[i]
			if (current[0] <= last[1] + 1) {
				last[1] = Math.max(last[1], current[1])
			} else {
				merged.push(current)
			}
		}
		return merged
	}

	const generateHighlightedSegments = (inputText: string, regions: [number, number][] = []): TextSegment[] => {
		if (regions.length === 0) {
			return [{ text: inputText, isHighlighted: false }];
		}

		const mergedRegions = mergeRegions(regions);
		const segments: TextSegment[] = [];
		let nextUnhighlightedRegionStartingIndex = 0;

		mergedRegions.forEach((region) => {
			const start = region[0];
			const end = region[1];
			const lastRegionNextIndex = end + 1;

			if (nextUnhighlightedRegionStartingIndex < start) {
				segments.push({
					text: inputText.substring(nextUnhighlightedRegionStartingIndex, start),
					isHighlighted: false,
				});
			}

			segments.push({
				text: inputText.substring(start, lastRegionNextIndex),
				isHighlighted: true,
			});

			nextUnhighlightedRegionStartingIndex = lastRegionNextIndex;
		});

		if (nextUnhighlightedRegionStartingIndex < inputText.length) {
			segments.push({
				text: inputText.substring(nextUnhighlightedRegionStartingIndex),
				isHighlighted: false,
			});
		}

		return segments;
	}

	return fuseSearchResult
		.filter(({ matches }) => matches && matches.length)
		.map(({ item, matches }): HighlightedItem => {
			const highlightedItem: HighlightedItem = {
				id: item.id,
				html: typeof item.html === 'string' ? [{ text: item.html, isHighlighted: false }] : [...item.html]
			}

			matches?.forEach((match) => {
				if (match.key && typeof match.value === "string" && match.indices) {
					const mergedIndices = mergeRegions([...match.indices])
					set(highlightedItem, match.key, generateHighlightedSegments(match.value, mergedIndices))
				}
			})

			return highlightedItem
		})
}

const HighlightedText: React.FC<{ segments: TextSegment[] }> = ({ segments }) => {
	return (
		<>
			{segments.map((segment, index) => (
				segment.isHighlighted ? (
					<span key={index} className="infio-llm-setting-model-item-highlight">{segment.text}</span>
				) : (
					<span key={index}>{segment.text}</span>
				)
			))}
		</>
	);
};

type ModelType = 'chat' | 'insight' | 'apply' | 'embedding'

interface ModelSelectProps {
	modelType?: ModelType
}

export function ModelSelect({ modelType = 'chat' }: ModelSelectProps) {
	const { settings, setSettings } = useSettings()
	const [isOpen, setIsOpen] = useState(false)

	// 根据模型类型获取相应的设置
	const currentModelProvider = useMemo(() => {
		switch (modelType) {
			case 'insight':
				return settings.insightModelProvider
			case 'apply':
				return settings.applyModelProvider
			case 'embedding':
				return settings.embeddingModelProvider
			default:
				return settings.chatModelProvider
		}
	}, [modelType, settings.insightModelProvider, settings.applyModelProvider, settings.embeddingModelProvider, settings.chatModelProvider])

	const currentModelId = useMemo(() => {
		switch (modelType) {
			case 'insight':
				return settings.insightModelId
			case 'apply':
				return settings.applyModelId
			case 'embedding':
				return settings.embeddingModelId
			default:
				return settings.chatModelId
		}
	}, [modelType, settings.insightModelId, settings.applyModelId, settings.embeddingModelId, settings.chatModelId])

	const [modelProvider, setModelProvider] = useState(currentModelProvider)
	const [chatModelId, setChatModelId] = useState(currentModelId)
	const [modelIds, setModelIds] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [searchTerm, setSearchTerm] = useState("")
	const [selectedIndex, setSelectedIndex] = useState(0)
	const inputRef = useRef<HTMLInputElement>(null)

	const providers = useMemo(() => {
		if (modelType === 'embedding') {
			return GetEmbeddingProviders()
		}
		return GetAllProviders()
	}, [modelType])

	useEffect(() => {
		const fetchModels = async () => {
			setIsLoading(true)
			try {
				if (modelType === 'embedding') {
					const models = await GetEmbeddingProviderModelIds(modelProvider, settings)
					setModelIds(models)
				} else {
					const models = await GetProviderModelsWithSettings(modelProvider, settings)
					setModelIds(Object.keys(models))
				}
			} catch (error) {
				console.error('Failed to fetch provider models:', error)
				setModelIds([])
			} finally {
				setIsLoading(false)
			}
		}

		fetchModels()
	}, [modelProvider, settings])

	// Sync model id & model provider based on modelType
	useEffect(() => {
		setModelProvider(currentModelProvider)
		setChatModelId(currentModelId)
	}, [currentModelProvider, currentModelId])

	const searchableItems = useMemo(() => {
		// 根据模型类型获取相应的收藏列表
		const getCollectedModels = () => {
			switch (modelType) {
				case 'insight':
					return settings.collectedInsightModels || []
				case 'apply':
					return settings.collectedApplyModels || []
				case 'embedding':
					return settings.collectedEmbeddingModels || []
				default:
					return settings.collectedChatModels || []
			}
		}

		// 检查是否在收藏列表中
		const isInCollected = (id: string) => {
			return getCollectedModels().some(item => item.provider === modelProvider && item.modelId === id) || false;
		};

		return modelIds.map((id) => ({
			id,
			html: id,
			provider: modelProvider,
			isCollected: isInCollected(id),
		}))
	}, [modelIds, modelProvider, modelType, settings.collectedChatModels, settings.collectedInsightModels, settings.collectedApplyModels, settings.collectedEmbeddingModels])

	const fuse = useMemo(() => {
		return new Fuse<SearchableItem>(searchableItems, {
			keys: ["html"],
			threshold: 1,
			shouldSort: true,
			isCaseSensitive: false,
			ignoreLocation: false,
			includeMatches: true,
			minMatchCharLength: 2,
		})
	}, [searchableItems])

	const filteredOptions = useMemo(() => {
		// 首先获取搜索结果
		const results: HighlightedItem[] = searchTerm
			? highlight(fuse.search(searchTerm))
			: searchableItems.map(item => ({
				...item,
				html: typeof item.html === 'string' ? [{ text: item.html, isHighlighted: false }] : item.html
			}))

		// 如果没有搜索关键词，按收藏状态排序（收藏的在前面）
		if (!searchTerm) {
			return [...results.filter(item => item.isCollected), ...results.filter(item => !item.isCollected)]
		}

		return results
	}, [searchableItems, searchTerm, fuse])

	const toggleCollected = (id: string, e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();

		// 根据模型类型获取相应的收藏列表
		const getCollectedModels = () => {
			switch (modelType) {
				case 'insight':
					return settings.collectedInsightModels || []
				case 'apply':
					return settings.collectedApplyModels || []
				case 'embedding':
					return settings.collectedEmbeddingModels || []
				default:
					return settings.collectedChatModels || []
			}
		}

		const currentCollectedModels = getCollectedModels();
		const isCurrentlyCollected = currentCollectedModels.some(
			item => item.provider === modelProvider && item.modelId === id
		);

		let newCollectedModels = [...currentCollectedModels];

		if (isCurrentlyCollected) {
			// remove
			newCollectedModels = newCollectedModels.filter(
				item => !(item.provider === modelProvider && item.modelId === id)
			);
		} else {
			// add
			newCollectedModels = [...newCollectedModels, { provider: modelProvider, modelId: id }];
		}

		// 根据模型类型更新相应的设置
		switch (modelType) {
			case 'insight':
				setSettings({
					...settings,
					collectedInsightModels: newCollectedModels,
				});
				break;
			case 'apply':
				setSettings({
					...settings,
					collectedApplyModels: newCollectedModels,
				});
				break;
			case 'embedding':
				setSettings({
					...settings,
					collectedEmbeddingModels: newCollectedModels,
				});
				break;
			default:
				setSettings({
					...settings,
					collectedChatModels: newCollectedModels,
				});
				break;
		}
	};

	return (
		<>
			<DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
				<DropdownMenu.Trigger className="infio-chat-input-model-select">
					{/* <div className="infio-chat-input-model-select__mode-icon">
						<Brain size={16} />
					</div> */}
					<div
						className="infio-chat-input-model-select__model-name"
						title={chatModelId}
					>
						{getOptimizedModelName(chatModelId)}
					</div>
					<div className="infio-chat-input-model-select__icon">
						{isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
					</div>
				</DropdownMenu.Trigger>

				<DropdownMenu.Portal>
					<DropdownMenu.Content className="infio-popover infio-llm-setting-combobox-dropdown">
						{/* collected models */}
						{(() => {
							const getCollectedModels = () => {
								switch (modelType) {
									case 'insight':
										return settings.collectedInsightModels || []
									case 'apply':
										return settings.collectedApplyModels || []
									case 'embedding':
										return settings.collectedEmbeddingModels || []
									default:
										return settings.collectedChatModels || []
								}
							}

							const collectedModels = getCollectedModels()

							return collectedModels.length > 0 ? (
								<div className="infio-model-section">
									<div className="infio-model-section-title">
										<Star size={12} className="infio-star-active" /> {t('chat.input.collectedModels')}
									</div>
									<ul className="infio-collected-models-list">
										{collectedModels.map((collectedModel, index) => (
											<DropdownMenu.Item
												key={`${collectedModel.provider}-${collectedModel.modelId}`}
												onSelect={() => {
													// 根据模型类型更新相应的设置
													switch (modelType) {
														case 'insight':
															setSettings({
																...settings,
																insightModelProvider: collectedModel.provider,
																insightModelId: collectedModel.modelId,
															})
															break;
														case 'apply':
															setSettings({
																...settings,
																applyModelProvider: collectedModel.provider,
																applyModelId: collectedModel.modelId,
															})
															break;
														case 'embedding':
															setSettings({
																...settings,
																embeddingModelProvider: collectedModel.provider,
																embeddingModelId: collectedModel.modelId,
															})
															break;
														default:
															setSettings({
																...settings,
																chatModelProvider: collectedModel.provider,
																chatModelId: collectedModel.modelId,
															})
															break;
													}
													setChatModelId(collectedModel.modelId)
													setSearchTerm("")
													setIsOpen(false)
												}}
												className={`infio-llm-setting-combobox-option ${index === selectedIndex ? 'is-selected' : ''}`}
												onMouseEnter={() => setSelectedIndex(index)}
												asChild
											>
												<li
													className="infio-llm-setting-model-item infio-collected-model-item"
													title={`${collectedModel.provider}/${collectedModel.modelId}`}
												>
													<div className="infio-model-item-text-wrapper">
														<span className="infio-provider-badge">{collectedModel.provider}</span>
														<span title={collectedModel.modelId}>{collectedModel.modelId}</span>
													</div>
													<div
														className="infio-model-item-star"
														title="remove from collected models"
													>
														<Star size={16} className="infio-star-active" onClick={(e) => {
															e.stopPropagation();
															e.preventDefault();
															// delete 
															const newCollectedModels = collectedModels.filter(
																item => !(item.provider === collectedModel.provider && item.modelId === collectedModel.modelId)
															);

															// 根据模型类型更新相应的设置
															switch (modelType) {
																case 'insight':
																	setSettings({
																		...settings,
																		collectedInsightModels: newCollectedModels,
																	});
																	break;
																case 'apply':
																	setSettings({
																		...settings,
																		collectedApplyModels: newCollectedModels,
																	});
																	break;
																case 'embedding':
																	setSettings({
																		...settings,
																		collectedEmbeddingModels: newCollectedModels,
																	});
																	break;
																default:
																	setSettings({
																		...settings,
																		collectedChatModels: newCollectedModels,
																	});
																	break;
															}
														}} />
													</div>
												</li>
											</DropdownMenu.Item>
										))}
									</ul>
									<div className="infio-model-separator"></div>
								</div>
							) : null
						})()}

						<div className="infio-llm-setting-search-container">
							<div className="infio-llm-setting-provider-container">
								<select
									className="infio-llm-setting-provider-switch"
									value={modelProvider}
									onChange={(e) => {
										const newProvider = e.target.value as ApiProvider
										setModelProvider(newProvider)
										setSearchTerm("")
										setSelectedIndex(0)
									}}
								>
									{providers.map((provider) => (
										<option
											key={provider}
											value={provider}
											className={`infio-llm-setting-provider-option ${provider === modelProvider ? 'is-active' : ''}`}
										>
											{provider}
										</option>
									))}
								</select>
							</div>
							{modelIds.length > 0 ? (
								<div className="infio-search-input-container">
									<input
										type="text"
										className="infio-llm-setting-item-search"
										placeholder="search model..."
										ref={inputRef}
										value={searchTerm}
										onChange={(e) => {
											setSearchTerm(e.target.value)
											setSelectedIndex(0)
											// Ensure the input is focused in the next render cycle
											setTimeout(() => {
												inputRef.current?.focus()
											}, 0)
										}}
										onKeyDown={(e) => {
											switch (e.key) {
												case "ArrowDown":
													e.preventDefault()
													setSelectedIndex((prev) =>
														Math.min(prev + 1, filteredOptions.length - 1)
													)
													break
												case "ArrowUp":
													e.preventDefault()
													setSelectedIndex((prev) => Math.max(prev - 1, 0))
													break
												case "Enter": {
													e.preventDefault()
													const selectedOption = filteredOptions[selectedIndex]
													if (selectedOption) {
														// 根据模型类型更新相应的设置
														switch (modelType) {
															case 'insight':
																setSettings({
																	...settings,
																	insightModelProvider: modelProvider,
																	insightModelId: selectedOption.id,
																})
																break;
															case 'apply':
																setSettings({
																	...settings,
																	applyModelProvider: modelProvider,
																	applyModelId: selectedOption.id,
																})
																break;
															case 'embedding':
																setSettings({
																	...settings,
																	embeddingModelProvider: modelProvider,
																	embeddingModelId: selectedOption.id,
																})
																break;
															default:
																setSettings({
																	...settings,
																	chatModelProvider: modelProvider,
																	chatModelId: selectedOption.id,
																})
																break;
														}
														setChatModelId(selectedOption.id)
														setSearchTerm("")
														setIsOpen(false)
													}
													break
												}
												case "Escape":
													e.preventDefault()
													setIsOpen(false)
													setSearchTerm("")
													break
											}
										}}
									/>
								</div>
							) : (
								<input
									type="text"
									className="infio-llm-setting-item-search"
									placeholder="input custom model name"
									ref={inputRef}
									value={searchTerm}
									onChange={(e) => {
										setSearchTerm(e.target.value)
										// ensure the input is focused in the next render cycle
										setTimeout(() => {
											inputRef.current?.focus()
										}, 0)
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault()
											// 根据模型类型更新相应的设置
											switch (modelType) {
												case 'insight':
													setSettings({
														...settings,
														insightModelProvider: modelProvider,
														insightModelId: searchTerm,
													})
													break;
												case 'apply':
													setSettings({
														...settings,
														applyModelProvider: modelProvider,
														applyModelId: searchTerm,
													})
													break;
												case 'embedding':
													setSettings({
														...settings,
														embeddingModelProvider: modelProvider,
														embeddingModelId: searchTerm,
													})
													break;
												default:
													setSettings({
														...settings,
														chatModelProvider: modelProvider,
														chatModelId: searchTerm,
													})
													break;
											}
											setChatModelId(searchTerm)
											setIsOpen(false)
										}
									}}
								/>
							)}
						</div>
						{isLoading ? (
							<div className="infio-loading">{t('chat.input.loading')}</div>
						) : (
							<div className="infio-model-section">
								<ul>
									{filteredOptions.map((option, index) => {
										// 计算正确的选中索引，考虑搜索模式和非搜索模式
										const isSelected = searchTerm
											? index === selectedIndex
											: index + settings.collectedChatModels?.length === selectedIndex;

										return (
											<DropdownMenu.Item
												key={option.id}
												onSelect={() => {
													// 根据模型类型更新相应的设置
													switch (modelType) {
														case 'insight':
															setSettings({
																...settings,
																insightModelProvider: modelProvider,
																insightModelId: option.id,
															})
															break;
														case 'apply':
															setSettings({
																...settings,
																applyModelProvider: modelProvider,
																applyModelId: option.id,
															})
															break;
														case 'embedding':
															setSettings({
																...settings,
																embeddingModelProvider: modelProvider,
																embeddingModelId: option.id,
															})
															break;
														default:
															setSettings({
																...settings,
																chatModelProvider: modelProvider,
																chatModelId: option.id,
															})
															break;
													}
													setChatModelId(option.id)
													setSearchTerm("")
													setIsOpen(false)
												}}
												className={`infio-llm-setting-combobox-option ${isSelected ? 'is-selected' : ''}`}
												onMouseEnter={() => {
													// 计算正确的鼠标悬停索引
													const getCollectedModels = () => {
														switch (modelType) {
															case 'insight':
																return settings.collectedInsightModels || []
															case 'apply':
																return settings.collectedApplyModels || []
															case 'embedding':
																return settings.collectedEmbeddingModels || []
															default:
																return settings.collectedChatModels || []
														}
													}
													const hoverIndex = searchTerm
														? index
														: index + getCollectedModels().length;
													setSelectedIndex(hoverIndex);
												}}
												asChild
											>
												<li
													className={`infio-llm-setting-model-item ${option.isCollected ? 'infio-collected-model-item' : ''}`}
													title={option.id}
												>
													<div className="infio-model-item-text-wrapper">
														{searchTerm ? (
															<HighlightedText segments={option.html} />
														) : (
															<span title={option.id}>{option.id}</span>
														)}
													</div>
													<div
														className="infio-model-item-star"
														onClick={(e) => toggleCollected(option.id, e)}
														title={option.isCollected ? "star" : "unstar"}
													>
														{option.isCollected ?
															<Star size={16} className="infio-star-active" /> :
															<Star size={16} className="infio-star-inactive" />
														}
													</div>
												</li>
											</DropdownMenu.Item>
										);
									})}
								</ul>
							</div>
						)}
					</DropdownMenu.Content>
				</DropdownMenu.Portal>
			</DropdownMenu.Root>
			<style>
				{`
					/* Model item styles */
					.infio-llm-setting-model-item {
						display: block;
						padding: 0;
						transition: background-color 0.2s ease;
					}
					
					.infio-llm-setting-combobox-option:hover {
						background-color: var(--background-modifier-hover);
					}
					
					.infio-llm-setting-combobox-option.is-selected {
						background-color: var(--background-modifier-active);
						border-left: 3px solid var(--interactive-accent);
					}
					
					/* Text overflow handling */
					.infio-model-item-text-wrapper {
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
						max-width: 250px;
						display: block;
						flex: 1;
					}
					
					/* Model name display optimization */
					.infio-chat-input-model-select__model-name {
						white-space: nowrap;
						overflow: hidden;
						text-overflow: ellipsis;
						max-width: 200px;
						cursor: pointer;
					}
					.infio-llm-setting-model-item {
						display: flex;
						flex-direction: row;
						align-items: center;
						justify-content: space-between;
						padding: 4px 10px 4px 6px;
						border-radius: 4px;
						margin: 2px 4px;
						transition: all 0.15s ease;
					}
					}
					
					.infio-collected-model-item {
						background-color: rgba(147, 112, 219, 0.05);
					}
					
					.infio-model-item-star {
						cursor: pointer;
						display: flex;
						align-items: center;
						justify-content: center;
						opacity: 0.6;
						transition: opacity 0.2s ease;
					}
					
					.infio-model-item-star:hover {
						opacity: 1;
					}
					
					.infio-star-active {
						color: #FFD700;
						fill: #FFD700;
						filter: drop-shadow(0 0 1px rgba(255, 215, 0, 0.4));
					}
					
					.infio-star-inactive {
						color: var(--text-muted);
					}
					
					.infio-model-item-text-wrapper span {
						display: inline;
					}

					/* Highlighted text style - use purple instead of theme color */
					.infio-llm-setting-model-item-highlight {
						display: inline;
						color: #9370DB;
						font-weight: 700;
						background-color: rgba(147, 112, 219, 0.15);
						padding: 1px 3px;
						border-radius: 3px;
						margin: 0 1px;
					}
					
					/* Search container */
					.infio-llm-setting-search-container {
						display: flex;
						flex-direction: row;
						justify-content: space-between;
						gap: 2px;
						border-bottom: 1px solid var(--background-modifier-border);
						padding: 2px 2px 3px;
						background-color: var(--background-secondary-alt);
						border-radius: 2px 2px 0 0;
					}
					
					/* Provider selector container */
					.infio-llm-setting-provider-container {
						position: relative;
						display: flex;
						align-items: center;
						flex: 0 0 auto;
						width: 45%;
					}
					
					/* Provider selector */
					.infio-llm-setting-provider-switch {
						width: 100% !important;
						margin: 0;
						padding: 6px 8px;
						text-align: left;
						appearance: none;
						-webkit-appearance: none;
						border: 1px solid var(--background-modifier-border);
						border-radius: 4px;
						font-weight: 500;
						font-size: 0.9em;
						transition: all 0.2s ease;
						cursor: pointer;
						box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
						background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
						background-repeat: no-repeat;
						background-position: right 8px center;
						background-size: 12px;
						padding-right: 28px;
					}
					
					.infio-llm-setting-provider-switch:hover {
						border-color: var(--interactive-accent);
					}
					
					.infio-llm-setting-provider-switch:focus {
						border-color: var(--interactive-accent);
						box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.25);
						outline: none;
					}
					
					/* Search container */
					.infio-search-input-container {
						position: relative;
						display: flex;
						align-items: center;
						flex: 1 1 auto;
						width: 50%;
					}

					/* Search input */
					.infio-llm-setting-item-search {
						width: 100% !important;
						border: 1px solid var(--background-modifier-border);
						margin: 0;
						padding: 6px 12px;
						border-radius: 6px !important;
						background-color: var(--background-primary);
						transition: all 0.2s ease;
						height: auto;
						font-size: 0.9em;
						box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
					}
					
					.infio-llm-setting-item-search:hover {
						border-color: var(--interactive-accent);
						background-color: var(--background-primary-alt);
					}
					
					.infio-llm-setting-item-search:focus {
						border-color: var(--interactive-accent);
						box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.25);
						outline: none;
					}
					
					/* Dropdown menu container */
					.infio-llm-setting-combobox-dropdown {
						max-height: 400px;
						box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08);
						border-radius: 8px;
						border: 1px solid var(--background-modifier-border);
					}
					
					/* 模型区域样式 */
					.infio-model-section {
						padding: 0;
						max-height: 300px;
						overflow-y: auto;
					}
					
					.infio-model-section-title {
						font-size: 12px;
						color: var(--text-muted);
						padding: 4px 8px;
						display: flex;
						align-items: center;
						gap: 4px;
						background-color: var(--background-secondary);
						margin-top: 2px;
					}
					
					.infio-model-separator {
						height: 1px;
						background-color: var(--background-modifier-border);
						margin: 4px 0;
					}
					
					/* 加载状态 */
					.infio-loading {
						padding: 8px;
						text-align: center;
						color: var(--text-muted);
					}
					
					/* 收藏列表 */
					.infio-collected-models-list {
						margin: 0;
						padding: 0;
						border-radius: 4px;
						overflow: hidden;
					}
					
					/* Provider 标签 */
					.infio-provider-badge {
						font-size: 10px;
						padding: 2px 6px;
						border-radius: 4px;
						margin-right: 6px;
						font-weight: 500;
					}
				`}
			</style>
		</>
	)
}
