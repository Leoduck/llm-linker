import { ItemView, WorkspaceLeaf, Notice, requestUrl, parseFrontMatterTags, Vault, getAllTags, TFile} from 'obsidian';
import { taggingPrompt } from 'prompts/tagging';

export const VIEW_TYPE_TAGGING = 'tag-view';

interface TagSuggestions {
  vaultTags: string[];
  newTags: string[];
}

export class TagView extends ItemView {
  private activeFile: any;
  private onFileChangeHandler: () => void;

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

    this.activeFile = this.app.workspace.getActiveFile();
    this.renderView(container);
    this.setupFileChangeListener(container);
  }

  private setupFileChangeListener(container: Element) {
    this.onFileChangeHandler = () => {
      const newActiveFile = this.app.workspace.getActiveFile();
      if (newActiveFile !== this.activeFile) {
        this.activeFile = newActiveFile;
        container.empty();
        this.renderView(container);
      }
    };

    this.app.workspace.on('active-leaf-change', this.onFileChangeHandler);
  }

  async renderView(container: Element) {
    container.createEl('h4', { text: 'Tagging suggestions' });
    
    if (!this.activeFile) {
      container.createEl('p', { text: 'No active note is open.' });
      return;
    }

    const usedTags = this.getAllVaultTags();
    const contentEl = container.createEl('div', { cls: 'note-content' });
    const llmButton = this.createLLMButton(contentEl, usedTags);
  }

  private getAllVaultTags(): Set<string> {
    const files: TFile[] = this.app.vault.getMarkdownFiles();
    const usedTags: Set<string> = new Set<string>();
    files.forEach((file: TFile) => {
      const tags: string[] = parseFrontMatterTags(this.app.metadataCache.getFileCache(file)?.frontmatter) || [];
      tags.forEach((tag: string) => usedTags.add(tag));
    });
    return usedTags;
  }

  private createLLMButton(container: Element, usedTags: Set<string>): HTMLElement {
    const llmButton = container.createEl('button', { cls: 'generate-tags-button', text: 'Ask LLM for tags' });
    llmButton.addEventListener('click', () => this.handleLLMRequest(container, usedTags));
    return llmButton;
  }

  private async handleLLMRequest(container: Element, usedTags: Set<string>) {
    const spinner = this.createLoadingSpinner(container);
    const existingTags = this.getExistingTags();
    const fileContent = await this.app.vault.read(this.activeFile);

    try {
      const suggestions = await this.requestTagSuggestions(usedTags, existingTags, fileContent);
      spinner.remove();
      this.displayTagSuggestions(container, suggestions, existingTags);
    } catch (error) {
      spinner.remove();
      console.error('Error:', error);
      new Notice('Failed to get tag suggestions');
    }
  }

  private createLoadingSpinner(container: Element): HTMLElement {
    const spinner = container.createEl('div', { cls: 'loading-spinner' });
    spinner.textContent = 'Loading...';
    return spinner;
  }

  private getExistingTags(): string[] {
    return parseFrontMatterTags(
      this.app.metadataCache.getFileCache(this.activeFile)?.frontmatter
    ) || [];
  }

  private async requestTagSuggestions(usedTags: Set<string>, existingTags: string[], fileContent: string): Promise<TagSuggestions> {
    // For development/testing, use mock data instead of actual LLM response
    if (false) {
      return {
        vaultTags: ['research', 'programming', 'obsidian', 'plugins'],
        newTags: ['llm-integration', 'api-development', 'typescript', 'documentation']
      };
    }
    const response = await requestUrl({
      method: 'POST',
      url: 'http://localhost:11434/api/generate',
      body: JSON.stringify({
        prompt: taggingPrompt(usedTags, existingTags, fileContent),
        model: 'deepseek-r1',
        stream: false,
      }),
    });

    const data = JSON.parse(response.text);
    // For development/testing, use mock data instead of actual LLM response
    
    const responseText = data.response;
    const jsonMatch = responseText.match(/\{([\s\S]*?)\}/);
    
    if (!jsonMatch) {
      throw new Error('Could not parse suggestions from LLM response');
    }

    return JSON.parse(jsonMatch[0]);
  }

  private displayTagSuggestions(container: Element, suggestions: TagSuggestions, existingTags: string[]) {
    if (suggestions.vaultTags.length < 1 && suggestions.newTags.length < 1) {
      new Notice('No new suggestions found.');
      return;
    }

    const suggestionsEl = container.createEl('div', { cls: 'llm-suggestions' });
    
    if (suggestions.vaultTags.length > 0) {
      this.createTagSection(suggestionsEl, suggestions.vaultTags, 'Tags from other notes', 'vault-tag', existingTags);
    }

    if (suggestions.newTags.length > 0) {
      this.createTagSection(suggestionsEl, suggestions.newTags, 'New potential tags', 'new-tag', existingTags);
    }
  }

  private createTagSection(container: Element, tags: string[], title: string, tagClass: string, existingTags: string[]) {
    const section = container.createEl('div', { cls: `tag-suggestion-section ${tagClass}` });
    const sectionHeader = section.createEl('div', { cls: 'tag-suggestion-section-header' });
    sectionHeader.createEl('div', { cls: 'tag-suggestion-section-title', text: title });
    const removeButton = this.createRemoveButton(sectionHeader, section);
    
    const tagsList = section.createEl('div', { cls: 'multi-select-container' });
    
    tags.forEach(tag => this.createTagPill(tagsList, tag, existingTags));
  }

  private createRemoveButton(container: Element, sectionToRemove: Element): HTMLElement {
    const removeButton = container.createEl('a', { cls: 'remove-suggestions', text: 'x'});
    removeButton.addEventListener('click', () => sectionToRemove.remove());
    return removeButton;
  }

  private createTagPill(container: Element, tag: string, existingTags: string[]) {
    const pill = container.createEl('div', { cls: `multi-select-pill` });
    pill.setAttribute('tabindex', '0');
    
    const pillContent = pill.createEl('div', { cls: 'multi-select-pill-content' });
    pillContent.createEl('span', { text: tag });

    pill.addEventListener('click', () => this.handleTagClick(pill, tag, container, existingTags));
  }

  private handleTagClick(pill: Element, tag: string, container: Element, existingTags: string[]) {
    this.app.fileManager.processFrontMatter(this.activeFile, (frontmatter) => {
      if (!frontmatter.tags) {
        frontmatter.tags = [tag];
      } else if (!frontmatter.tags.includes(tag)) {
        frontmatter.tags.push(tag);
        existingTags.push(tag);
      }
    });

    pill.remove();
    if (container.children.length === 0) {
      container.parentElement?.remove();
    }
  }

  async onClose() {
    if (this.onFileChangeHandler) {
      this.app.workspace.off('active-leaf-change', this.onFileChangeHandler);
    }
  }
}
