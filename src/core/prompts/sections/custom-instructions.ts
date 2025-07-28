
import * as path from 'path'

import { App, normalizePath } from 'obsidian'

import { ROOT_DIR } from '../constants'

export async function loadRuleFiles(
	app: App,
	mode: string,
): Promise<string> {
	const ruleFilesFolder = path.join(ROOT_DIR, `${mode}/rules/`)
	if (!(await app.vault.adapter.exists(ruleFilesFolder))) {
		return ""
	}

	const ruleFiles = await app.vault.adapter.list(normalizePath(ruleFilesFolder))

	let combinedRules = ""
	for (const file of ruleFiles.files) {
		const content = await app.vault.adapter.read(normalizePath(file))
		if (content) {
			combinedRules += `\n# Rules from ${file}:\n${content}\n`
		}
	}

	return combinedRules
}

export async function addCustomInstructions(
	app: App,
	modeCustomInstructions: string,
	globalCustomInstructions: string,
	cwd: string,
	mode: string,
	options: { preferredLanguage?: string } = {},
): Promise<string> {
	const sections = []

	// Load mode-specific rules file if mode is provided
	let modeRuleContent = ""
	if (mode) {
		const modeRulesFile = path.join(ROOT_DIR, `${mode}/rules.md`)
		if (await app.vault.adapter.exists(modeRulesFile)) {
			modeRuleContent = await app.vault.adapter.read(normalizePath(modeRulesFile))
		}
	}

	// Add language preference if provided
	if (options.preferredLanguage) {
		sections.push(
			`Language Preference:\nYou should always speak and think in the ${options.preferredLanguage} language.`,
		)
	}

	// Add global instructions first
	if (typeof globalCustomInstructions === "string" && globalCustomInstructions.trim()) {
		sections.push(`Global Instructions:\n${globalCustomInstructions.trim()}`)
	}

	// Add mode-specific instructions after
	if (typeof modeCustomInstructions === "string" && modeCustomInstructions.trim()) {
		sections.push(`Mode-specific Instructions:\n${modeCustomInstructions.trim()}`)
	}

	// Add rules - include both mode-specific and generic rules if they exist
	const rules = []

	// Add mode-specific rules first if they exist
	if (modeRuleContent && modeRuleContent.trim()) {
		const modeRuleFile = `${mode}_rules.md`
		rules.push(`# Rules from ${modeRuleFile}:\n${modeRuleContent}`)
	}

	// Add generic rules
	const genericRuleContent = await loadRuleFiles(app, mode)
	if (genericRuleContent && genericRuleContent.trim()) {
		rules.push(genericRuleContent.trim())
	}

	if (rules.length > 0) {
		sections.push(`Rules:\n\n${rules.join("\n\n")}`)
	}

	const joinedSections = sections.join("\n\n")

	return joinedSections
		? `
====

INSTRUCTIONS

${joinedSections}`
		: ""
}
