/*
 * This file is unused and potentially deprecated.
 * Please refer to the new settings structure for model parameter configuration.
 */

import * as React from "react";

import { InfioSettings } from '../../types/settings';
import {
	MAX_FREQUENCY_PENALTY,
	MAX_MAX_TOKENS,
	MAX_PRESENCE_PENALTY,
	MAX_TEMPERATURE,
	MAX_TOP_P,
	MIN_FREQUENCY_PENALTY,
	MIN_MAX_TOKENS,
	MIN_PRESENCE_PENALTY,
	MIN_TEMPERATURE,
	MIN_TOP_P
} from "../versions";

import SliderSettingsItem from "./SliderSettingsItem";

type Props = {
    settings: InfioSettings;
    updateSettings: (update: Partial<InfioSettings>) => void;
    errors: Map<string, string>;
}

export default function ModelParametersSettings({ settings, updateSettings, errors }: Props): React.JSX.Element {
    return (
        <>
            <SliderSettingsItem
                name={"Temperature"}
                description={
                    "This parameter affects randomness in the sampling. Lower values result in more repetitive and deterministic responses. Higher temperatures will result in more unexpected or creative responses."
                }
                value={settings.modelOptions.temperature}
                errorMessage={errors.get("modelOptions.temperature")}
                setValue={(value: number) =>
                    updateSettings({
                        modelOptions: {
                            ...settings.modelOptions,
                            temperature: value,
                        },
                    })
                }
                min={MIN_TEMPERATURE}
                max={MAX_TEMPERATURE}
                step={0.05}
            />
            <SliderSettingsItem
                name={"TopP"}
                description={
                    "Like the temperature parameter, the Top P parameter affects the randomness in sampling. Lowering the value will limit the model's token selection to likelier tokens while increasing the value expands the model's token selection with lower likelihood tokens."
                }
                value={settings.modelOptions.top_p}
                errorMessage={errors.get("modelOptions.top_p")}
                setValue={(value: number) =>
                    updateSettings({
                        modelOptions: {
                            ...settings.modelOptions,
                            top_p: value,
                        },
                    })
                }
                min={MIN_TOP_P}
                max={MAX_TOP_P}
                step={0.05}
            />
            {/*This line is causing a lot of trouble, so I'm commenting it out for now. */}
            {/*{settings.deprecated.apiProvider !== "ollama" && (*/}
            {(
                <>
                    <SliderSettingsItem
                        name={"Frequency penalty"}
                        description={
                            "This parameter reduces the chance of repeating a token proportionally based on how often it has appeared in the text so far. This decreases the likelihood of repeating the exact same text in a response."
                        }
                        value={settings.modelOptions.frequency_penalty}
                        errorMessage={errors.get("modelOptions.frequency_penalty")}
                        setValue={(value: number) =>
                            updateSettings({
                                modelOptions: {
                                    ...settings.modelOptions,
                                    frequency_penalty: value,
                                },
                            })
                        }
                        min={MIN_FREQUENCY_PENALTY}
                        max={MAX_FREQUENCY_PENALTY}
                        step={0.05}
                    />
                    <SliderSettingsItem
                        name={"Presence penalty"}
                        description={
                            "This parameter reduces the chance of repeating any token that has appeared in the text so far. This increases the likelihood of introducing new topics in a response."
                        }
                        value={settings.modelOptions.presence_penalty}
                        errorMessage={errors.get("modelOptions.presence_penalty")}
                        setValue={(value: number) =>
                            updateSettings({
                                modelOptions: {
                                    ...settings.modelOptions,
                                    presence_penalty: value,
                                },
                            })
                        }
                        min={MIN_PRESENCE_PENALTY}
                        max={MAX_PRESENCE_PENALTY}
                        step={0.05}
                    />
                    <SliderSettingsItem
                        name={"Max tokens"}
                        description={
                            "This parameter changes the maximum number of tokens the model is allowed to generate. This includes the chain of thought tokens before the answer."
                        }
                        value={settings.modelOptions.max_tokens}
                        errorMessage={errors.get("modelOptions.max_tokens")}
                        setValue={(value: number) =>
                            updateSettings({
                                modelOptions: {
                                    ...settings.modelOptions,
                                    max_tokens: value,
                                },
                            })
                        }
                        min={MIN_MAX_TOKENS}
                        max={MAX_MAX_TOKENS}
                        step={10}
                    />
                </>
            )}
        </>
    );
}
