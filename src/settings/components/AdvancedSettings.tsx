import * as React from "react";

import { t } from '../../lang/helpers';
import { InfioSettings } from '../../types/settings';
import SettingsItem from "./SettingsItem";
import TextSettingItem from "./TextSettingItem";
import FewShotExampleSettings from "./FewShotExampleSettings";

type Props = {
    settings: InfioSettings;
    updateSettings: (update: Partial<InfioSettings>) => void;
    errors: Map<string, string>;
}

export default function AdvancedSettings({ settings, updateSettings, errors }: Props): React.JSX.Element {
    if (!settings.advancedMode) {
        return null;
    }

    return (
        <>
            <TextSettingItem
                name={t("settings.AutoComplete.advanced.chainOfThoughtRemovalRegex")}
                description={
                    t("settings.AutoComplete.advanced.chainOfThoughtRemovalRegexDescription")
                }
                placeholder={t("settings.AutoComplete.advanced.regexPlaceholder")}
                value={settings.chainOfThoughtRemovalRegex}
                errorMessage={errors.get("chainOfThoughtRemovalRegex")}
                setValue={(value: string) =>
                    updateSettings({
                        chainOfThoughtRemovalRegex: value,
                    })
                }
            />

            <SettingsItem
                name={t("settings.AutoComplete.advanced.systemMessage")}
                description={
                    t("settings.AutoComplete.advanced.systemMessageDescription")
                }
                display={"block"}
                errorMessage={errors.get("systemMessage")}
            >
                <textarea
                    className="infio-autocomplete-setting-item-textarea"
                    rows={10}
                    placeholder={t("settings.AutoComplete.advanced.systemMessagePlaceholder")}
                    value={settings.systemMessage}
                    onChange={(e) =>
                        updateSettings({
                            systemMessage: e.target.value,
                        })
                    }
                />
            </SettingsItem>

            <SettingsItem
                name={t("settings.AutoComplete.advanced.userMessageTemplate")}
                description={
                    t("settings.AutoComplete.advanced.userMessageTemplateDescription")
                }
                display={"block"}
                errorMessage={errors.get("userMessageTemplate")}
            >
                <textarea
                    className="infio-autocomplete-setting-item-textarea"
                    rows={3}
                    placeholder="{{prefix}}<mask/>{{suffix}}"
                    value={settings.userMessageTemplate}
                    onChange={(e) =>
                        updateSettings({
                            userMessageTemplate: e.target.value,
                        })
                    }
                />
            </SettingsItem>

            <FewShotExampleSettings
                fewShotExamples={settings.fewShotExamples}
                name={t("settings.AutoComplete.advanced.fewShotExamples")}
                description={
                    t("settings.AutoComplete.advanced.fewShotExamplesDescription")
                }
                setFewShotExamples={(value) =>
                    updateSettings({ fewShotExamples: value })
                }
                errorMessages={errors}
            />
        </>
    );
}
