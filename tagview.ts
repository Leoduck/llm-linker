import { ItemView, WorkspaceLeaf, Notice, requestUrl} from 'obsidian';
import { taggingPrompt } from 'prompts/tagging';

export const VIEW_TYPE_TAGGING = 'tag-view';

export class TagView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_TAGGING;
  }

  getDisplayText() {
    return 'Tag view';
  }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl('h4', { text: 'Tagging view' });

    // Get the active file
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
        // Read the content of the active file
        const fileContent = await this.app.vault.read(activeFile);

        // Create a new element to display the content
        const contentEl = container.createEl('div', { cls: 'note-content' });
        console.log('File content:', fileContent);
        const tagbutton = contentEl.createEl('button', { text: 'welcome' });
        tagbutton.addEventListener('click', () => {
          const tag = `#${tagbutton.textContent}`; // Add a hashtag to the tag
          const tagLine = `  - "${tag}"`; // Format the tag for frontmatter

          // Check if the file content already has frontmatter
          let newContent: string;
          if (fileContent.startsWith('---')) {
            // Append the tag to the end of the existing 'tags' section in the frontmatter
            const lines = fileContent.split('\n');
            const tagsIndex = lines.findIndex(line => line.trim() === 'tags:');
            if (tagsIndex !== -1) {
              // Find the end of the 'tags' section
              let insertIndex = tagsIndex + 1;
              while (insertIndex < lines.length && lines[insertIndex].startsWith('  -')) {
                insertIndex++;
              }
              // Add the tag at the end of the 'tags' section
              lines.splice(insertIndex, 0, tagLine);
            } else {
              // Add a new 'tags:' section if it doesn't exist
              lines.splice(1, 0, 'tags:', tagLine);
            }
            newContent = lines.join('\n');
          } else {
            // Add frontmatter if it doesn't exist
            newContent = `---\ntags:\n${tagLine}\n---\n${fileContent}`;
          }

          // Modify the file with the updated content
          this.app.vault.modify(activeFile, newContent).then(() => {
            console.log('File modified successfully!');
          }).catch((error) => {
            console.error('Error modifying file:', error);
          });
        });
    } else {
        // Handle the case where no file is open
        container.createEl('p', { text: 'No active note is open.' });
    }

    if (activeFile) {
        // Read the content of the active file
        const fileContent = await this.app.vault.read(activeFile);

        // Create a new element to display the content
        const contentEl = container.createEl('div', { cls: 'note-content' });
        console.log('File content:', fileContent);
        contentEl.textContent = fileContent;

        // Button to ask the LLM for improvements
        const llmButton = contentEl.createEl('button', { text: 'Ask LLM for Improvements' });
        llmButton.addEventListener('click', () => {
          requestUrl({
            method: 'POST',
            url: 'http://localhost:11434/api/generate',
            body: JSON.stringify({
              prompt: taggingPrompt + fileContent,
              model: 'deepseek-r1:latest',
              stream: false,
            })
          }).then((response) => {
            console.log('LLM response:', response.text); 
            const data = JSON.parse(response.text)
            console.log('Parsed LLM response:', data);
            // Display the LLM's suggestions in the content element
            const suggestionsEl = contentEl.createEl('div', { cls: 'llm-suggestions' });
            suggestionsEl.createEl('h4', { text: 'LLM Suggestions:' });
            suggestionsEl.createEl('p', { text: data.response }); // Assuming the response has a 'suggestions' field
            
          }).catch((error) => {
            console.error('Error:', error);
          });
        });
    } else {
        // Handle the case where no file is open
        container.createEl('p', { text: 'No active note is open.' });
    }
  }


  async onClose() {
    // Nothing to clean up.
  }
}
