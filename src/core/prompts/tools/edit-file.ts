import { ToolArgs } from "./types"

export function getEditFileDescription(args: ToolArgs): string {
	return `## edit_file
Description: Use this tool to make an edit to an existing file.

This will be read by a less intelligent model, which will quickly apply the edit. You should make it clear what the edit is, while also minimizing the unchanged content you write.
When writing the edit, you should specify each edit in sequence, with the special comment // ... existing content ... to represent unchanged content in between edited lines.

For example:

// ... existing content ...
FIRST_EDIT
// ... existing content ...
SECOND_EDIT
// ... existing content ...
THIRD_EDIT
// ... existing content ...

You should still bias towards repeating as few lines of the original file as possible to convey the change.
But, each edit should contain minimally sufficient context of unchanged lines around the content you're editing to resolve ambiguity.
DO NOT omit spans of pre-existing content without using the // ... existing content ... comment to indicate its absence. If you omit the existing content comment, the model may inadvertently delete these lines.
If you plan on deleting a section, you must provide context before and after to delete it. If the initial content is \`\`\`content \n Block 1 \n Block 2 \n Block 3 \n content\`\`\`, and you want to remove Block 2, you would output \`\`\`// ... existing content ... \n Block 1 \n  Block 3 \n // ... existing content ...\`\`\`.
Make sure it is clear what the edit should be, and where it should be applied.
ALWAYS make all edits to a file in a single edit_file instead of multiple edit_file calls to the same file. The apply model can handle many distinct edits at once.

Parameters:
- path: (required) The path of the file to edit (relative to the current working directory ${args.cwd})
- instruction: (required) A single sentence written in the first person describing what you're changing. Used to help disambiguate uncertainty in the edit.
- content_changes: (required) Specify ONLY the precise lines of content that you wish to edit. Use \`// ... existing content ...\` for unchanged sections.
Usage:
<edit_file>
<path>File path here</path>
<instruction>Instruction here</instruction>
<content_changes>Content changes here</content_changes>
</edit_file>
`
}
