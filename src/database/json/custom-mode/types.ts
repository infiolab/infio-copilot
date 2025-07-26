import { z } from "zod"

export const CUSTOM_MODE_SCHEMA_VERSION = 1

export const toolGroups = [
	"read",
	"edit",
	"research",
	// "browser",
	// "command",
	// "mcp",
	"modes",
] as const

export const toolGroupsSchema = z.enum(toolGroups)

export type ToolGroup = z.infer<typeof toolGroupsSchema>

export const groupOptionsSchema = z.object({
	fileRegex: z
		.string()
		.optional()
		.refine(
			(pattern) => {
				if (!pattern) {
					return true // Optional, so empty is valid.
				}

				try {
					new RegExp(pattern)
					return true
				} catch {
					return false
				}
			},
			{ message: "Invalid regular expression pattern" },
		),
	description: z.string().optional(),
})

export const groupEntrySchema = z.union([toolGroupsSchema, z.tuple([toolGroupsSchema, groupOptionsSchema])])

export type GroupEntry = z.infer<typeof groupEntrySchema>


const groupEntryArraySchema = z.array(groupEntrySchema).refine(
	(groups) => {
		const seen = new Set()

		return groups.every((group) => {
			// For tuples, check the group name (first element).
			const groupName = Array.isArray(group) ? group[0] : group

			if (seen.has(groupName)) {
				return false
			}

			seen.add(groupName)
			return true
		})
	},
	{ message: "Duplicate groups are not allowed" },
)

export const modeConfigSchema = z.object({
	id: z.string().uuid("Invalid ID"),
	slug: z.string().regex(/^[a-zA-Z0-9-]+$/, "Slug must contain only letters numbers and dashes"),
	name: z.string().min(1, "Name is required"),
	roleDefinition: z.string().min(1, "Role definition is required"),
	customInstructions: z.string().optional(),
	groups: groupEntryArraySchema,
	icon: z.string().optional(),
	source: z.enum(["global", "project"]).optional(),
	updatedAt: z.number().int().positive(),
	schemaVersion: z.literal(CUSTOM_MODE_SCHEMA_VERSION),
})

export type CustomMode = z.infer<typeof modeConfigSchema>

export type CustomModeMetadata = {
	id: string
	name: string
	updatedAt: number
	schemaVersion: number
}
