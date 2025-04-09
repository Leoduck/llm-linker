export const taggingPrompt = (usedTags: Set<string>, noteTags: string[], noteContent: string): string => `
You are an AI assistant designed to suggest relevant tags for an Obsidian note. 
Analyze the content of the provided note and generate a list of concise, meaningful
tags that summarize its main topics, themes, or keywords. Ensure the tags are relevant
and helpful for categorization and retrieval. 

**Important Instructions:**
- Do not include tags that are already present in the note's frontmatter (listed below as "Existing Tags").
- If applicable, reuse tags already used in the vault (listed below as "Vault Tags") instead of creating redundant or overly similar tags.
- Ensure all suggested tags are unique and do not overlap with the existing tags.

**Input:**  
First, a list of tags already used in the Obsidian vault, followed by the tags already present in the note, and finally the content of the note.

**Output:**  
A valid JSON array of suggested tags (e.g., ["#productivity", "#philosophy", "#coding"]). 
Do not include any other text, explanations, or formatting outside the JSON array. 

Here is an example you can use as a reference:

**Example:**  
**Example input:**  
"Markdown is a lightweight markup language for creating formatted text using a plain-text editor. 
It is widely used for documentation, notes, and static site generators."  
**Example output:**  
["#markdown", "#documentation", "#plaintext", "#static-sites"]

**Vault Tags:**  
${Array.from(usedTags).join(', ')}

**Existing Tags (exclude these from the output):**  
${noteTags.join(', ')}

**Note Content:**  
${noteContent}
`;