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
    container.createEl('h4', { text: 'Tagging suggestions' });

    // Get the active file
    //TODO: clean this up to work with the frontmatter
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile) {
        // Read the content of the active file
        const fileContent = await this.app.vault.read(activeFile);

        // Create a new element to display the content
        const contentEl = container.createEl('div', { cls: 'note-content' });
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

        // Button to ask the LLM for improvements
        const llmButton = contentEl.createEl('button', { text: 'Ask LLM for Improvements' });
        llmButton.addEventListener('click', () => {
          requestUrl({
            method: 'POST',
            url: 'http://localhost:11434/api/generate',
            body: JSON.stringify({
              prompt: taggingPrompt + fileContent,
              model: 'llama3.2',
              stream: false,
            })
          }).then((response) => {
            //Managing the response from the LLM
            //console.log('LLM response:', response.text); 
            const data = JSON.parse(response.text)
            const suggestions: string[] = JSON.parse(data.response)
            console.log('Parsed LLM response:', data.response);
            //console.log('Parsed LLM list:', suggestions);
            // Display the LLM's suggestions in the content element


            const suggestionsEl = contentEl.createEl('div', { cls: 'llm-suggestions' });
            suggestionsEl.createEl('h4', { text: 'LLM Suggestions:' });
            const suggestionsList = suggestionsEl.createEl('div', { cls: 'multi-select-container'});

            suggestions.forEach((suggestion: string) => {
              const pill = suggestionsList.createEl('div', {cls: 'multi-select-pill' });
              pill.setAttribute('tabindex', '0');
              const pillContent = pill.createEl('div', {cls: 'multi-select-pill-content' });
              pillContent.createEl('span', { text: suggestion});
            });
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
