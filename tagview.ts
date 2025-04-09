import { ItemView, WorkspaceLeaf, Notice, requestUrl, parseFrontMatterTags, Vault, getAllTags, TFile} from 'obsidian';
import { taggingPrompt } from 'prompts/tagging';

export const VIEW_TYPE_TAGGING = 'tag-view';

export class TagView extends ItemView {
  private activeFile: any; // Track the currently active file
  private onFileChangeHandler: () => void; // Store the event handler for cleanup

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

    // Initialize the active file
    this.activeFile = this.app.workspace.getActiveFile();

    // Render the view for the current active file
    this.renderView(container);

    // Listen for active file changes
    this.onFileChangeHandler = () => {
      const newActiveFile = this.app.workspace.getActiveFile();
      if (newActiveFile !== this.activeFile) {
        this.activeFile = newActiveFile;
        container.empty(); // Clear the container
        this.renderView(container); // Re-render the view
      }
    };

    this.app.workspace.on('active-leaf-change', this.onFileChangeHandler);
  }

  async renderView(container: Element) {
    const files: TFile[] = this.app.vault.getMarkdownFiles();
    const usedTags: Set<string> = new Set<string>();
    files.forEach((file: TFile) => {
      const tags: string[] = parseFrontMatterTags(this.app.metadataCache.getFileCache(file)?.frontmatter) || [];
      tags.forEach((tag: string) => {
        usedTags.add(tag);
      });
    });

    if (this.activeFile) {

      // Read the content of the active file
      const fileContent = await this.app.vault.read(this.activeFile);

      // Create a new element to display the content
      const contentEl = container.createEl('div', { cls: 'note-content' });
      // Button to ask the LLM for improvements
      const llmButton = contentEl.createEl('button', { text: 'Ask LLM for tags' });
      llmButton.addEventListener('click', () => {
        // Create a loading spinner
        const spinner = contentEl.createEl('div', { cls: 'loading-spinner' });
        spinner.textContent = 'Loading...'; // Optional: Add text to indicate loading

        // Get the tags from the frontmatter
        const existingTags: string[] = parseFrontMatterTags(
          this.app.metadataCache.getFileCache(this.activeFile)?.frontmatter
        ) || [];

        requestUrl({
          method: 'POST',
          url: 'http://localhost:11434/api/generate',
          body: JSON.stringify({
            prompt: taggingPrompt(usedTags, existingTags, fileContent),
            model: 'llama3.2',
            stream: false,
          }),
        })
          .then((response) => {
            // Remove the spinner once the response is received
            spinner.remove();

            const data = JSON.parse(response.text);
            const unfilSuggestions: string[] = JSON.parse(data.response);
            const suggestions = unfilSuggestions.filter((suggestion: string) => !existingTags.includes(suggestion)); // Filter out existing tags

            console.log('LLM suggestions:', suggestions);

            // Generate a list of suggestions from the LLM response
            if (suggestions.length < 1) {
              new Notice('No new suggestions found.');
            } else {
              // Display the LLM's suggestions in the content element
              const suggestionsEl = contentEl.createEl('div', { cls: 'llm-suggestions' });
              suggestionsEl.createEl('h4', { text: 'LLM Suggestions:' });
              const suggestionsList = suggestionsEl.createEl('div', { cls: 'multi-select-container' });
              const removeButton = suggestionsList.createEl('button', { cls: 'remove-suggestions', text: '✖'});
              removeButton.addEventListener('click', () => {
                suggestionsEl.remove(); // Remove the suggestionsEl element
              });

              suggestions.forEach((suggestion: string) => {
                const pill = suggestionsList.createEl('div', { cls: 'multi-select-pill' });
                // Adds the suggestion to the frontmatter tags when clicked
                pill.addEventListener('click', () => {
                  this.app.fileManager.processFrontMatter(this.activeFile, (frontmatter) => {
                    if (!frontmatter.tags) {
                      frontmatter.tags = [suggestion];
                    } else {
                      // Check if the suggestion is already in the tags array
                      if (!frontmatter.tags.includes(suggestion)) {
                        frontmatter.tags.push(suggestion);
                        existingTags.push(suggestion); // Add the suggestion to the existingTags array
                      }
                    }
                  });
                  pill.remove();

                  if (suggestionsList.children.length === 0) {
                    suggestionsEl.remove(); // Remove the suggestionsList element
                  }
                });
                pill.setAttribute('tabindex', '0');
                const pillContent = pill.createEl('div', { cls: 'multi-select-pill-content' });
                pillContent.createEl('span', { text: suggestion });
              });
            }
          })
          .catch((error) => {
            // Remove the spinner if an error occurs
            spinner.remove();
            console.error('Error:', error);
          });
      });
    } else {
      // Handle the case where no file is open
      container.createEl('p', { text: 'No active note is open.' });
    }
  }

  async onClose() {
    // Cleanup the event listener when the view is closed
    if (this.onFileChangeHandler) {
      this.app.workspace.off('active-leaf-change', this.onFileChangeHandler);
    }
  }
}
