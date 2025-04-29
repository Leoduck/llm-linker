export const linkbreakPrompt = (noteContent: string): string => `
You are an AI assistant designed to help organize and structure Obsidian notes by identifying sections that could be split into separate, linked notes.

Analyze the provided note content and identify sections that:
1. Could stand alone as their own notes
2. Would benefit from being referenced/linked from multiple places
3. Contain a complete thought or concept that might be referenced elsewhere

For each potential section you identify, provide:
- The exact text of the section
- A suggested title for the new note
- A clear explanation of why this section should be split into its own note

**Output Format:**
Provide a JSON object with an array of suggestions. Each suggestion should have:
- "section": The exact text of the section
- "title": A suggested title for the new note
- "reason": A clear explanation of why this section should be split

Example output format:
{
  "suggestions": [
    {
      "section": "The exact text of the section...",
      "title": "Suggested Note Title",
      "reason": "This section contains a complete concept that could be referenced from multiple notes..."
    }
  ]
}

**Note Content:**
${noteContent}
`;