export const linkSuggestionPrompt = (noteContent: string): string => `
You are an AI assistant designed to suggest potential links for an Obsidian note. 
Analyze the content of the provided note and identify words or phrases that could be meaningful links to other notes.

**Important Instructions:**
- Do not suggest words that are already linked in the note
- Focus on nouns, concepts, and key terms that could be meaningful note titles
- Consider both single words and short phrases (2-3 words)
- Ensure suggestions are relevant to the note's content
- Exclude common words, pronouns, and articles
- Each suggestion should be a potential note title that could contain relevant information

**Input:**  
The content of the note with links and all.

**Output:**  
A valid JSON object with an array of suggested link words/phrases (e.g., {"suggestions": ["markdown", "documentation", "static site generator"]}).
Do not include any other text, explanations, or formatting outside the JSON object.

Here is an example you can use as a reference:

**Example:**  
**Example input:**  
"Markdown is a lightweight markup language for creating formatted text using a plain-text editor. 
It is widely used for documentation, notes, and static site generators."  
**Example output:**  
{"suggestions": ["lightweight markup", "plain-text editor", "formatted text", "static site"]}


**Note Content:**  
${noteContent}
`;