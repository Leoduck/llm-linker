import { ItemView, WorkspaceLeaf, Notice, requestUrl, parseFrontMatterTags, TFile } from 'obsidian';
import { taggingPrompt } from '../prompts/tagging';
import { linksuggestPrompt } from '../prompts/linksuggest';
import LLMLinkerPlugin from './main';

export const VIEW_TYPE_LLMLINKER = 'llmlinker-view';

interface TagSuggestions {
  vaultTags: string[];
  newTags: string[];
}

interface LinkSuggestion {
  title: string;
  kickstarter: string;
  connection: string;
}

export class LLMLINKERView extends ItemView {
  private activeFile: TFile | null;
  private onFileChangeHandler: () => void;
  private plugin: LLMLinkerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: LLMLinkerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_LLMLINKER;
  }

  getDisplayText() {
    return 'Unified View';
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
    container.createEl('h4', { text: 'Unified Suggestions' });

    if (!this.activeFile) {
      container.createEl('p', { text: 'No active note is open.' });
      return;
    }

    const contentEl = container.createEl('div', { cls: 'note-content' });
    this.createLLMButtons(contentEl);
  }

  private createLLMButtons(container: Element) {
    const tagButton = container.createEl('button', { cls: 'generate-tags-button', text: 'Ask LLM for tags' });
    tagButton.addEventListener('click', () => this.handleTagRequest(container));

    const linkButton = container.createEl('button', { cls: 'generate-links-button', text: 'Ask LLM for links' });
    linkButton.addEventListener('click', () => this.handleLinkRequest(container));
  }

  private async handleTagRequest(container: Element) {
    const spinner = this.createLoadingSpinner(container);
    const usedTags = this.getAllVaultTags();
    const existingTags = this.getExistingTags();
    const fileContent = await this.app.vault.read(this.activeFile!);

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

  private async handleLinkRequest(container: Element) {
    const spinner = this.createLoadingSpinner(container);
    const fileContent = await this.app.vault.read(this.activeFile!);

    try {
      const suggestions = await this.requestLinkSuggestions(fileContent);
      spinner.remove();
      this.displayLinkSuggestions(container, suggestions);
    } catch (error) {
      spinner.remove();
      console.error('Error:', error);
      new Notice('Failed to get link suggestions');
    }
  }

  private createLoadingSpinner(container: Element): HTMLElement {
    const spinner = container.createEl('div', { cls: 'loading-spinner' });
    spinner.textContent = 'Loading...';
    return spinner;
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

  private getExistingTags(): string[] {
    return parseFrontMatterTags(
      this.app.metadataCache.getFileCache(this.activeFile!)?.frontmatter
    ) || [];
  }

  private async requestTagSuggestions(usedTags: Set<string>, existingTags: string[], fileContent: string): Promise<TagSuggestions> {
    const response = await requestUrl({
      method: 'POST',
      url: this.plugin.settings.llmEndpoint,
      body: JSON.stringify({
        prompt: taggingPrompt(usedTags, existingTags, fileContent),
        model: this.plugin.settings.llmModel,
        stream: false,
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = JSON.parse(response.text);
    return data;
  }

  private async requestLinkSuggestions(fileContent: string): Promise<LinkSuggestion[]> {
    const response = await requestUrl({
      method: 'POST',
      url: this.plugin.settings.llmEndpoint,
      body: JSON.stringify({
        prompt: linksuggestPrompt(fileContent),
        model: this.plugin.settings.llmModel,
        stream: false,
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const data = JSON.parse(response.text);
    return data.suggestions;
  }

  private displayTagSuggestions(container: Element, suggestions: TagSuggestions, existingTags: string[]) {
    if (suggestions.vaultTags.length < 1 && suggestions.newTags.length < 1) {
      new Notice('No new tag suggestions found.');
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

  private displayLinkSuggestions(container: Element, suggestions: LinkSuggestion[]) {
    if (suggestions.length < 1) {
      new Notice('No new link suggestions found.');
      return;
    }

    const suggestionsEl = container.createEl('div', { cls: 'llm-suggestions' });

    suggestions.forEach(suggestion => {
      const suggestionEl = suggestionsEl.createEl('div', { cls: 'link-suggestion' });
      suggestionEl.createEl('h5', { text: suggestion.title });
      suggestionEl.createEl('p', { text: suggestion.kickstarter });
      suggestionEl.createEl('small', { text: `Connection: ${suggestion.connection}` });
    });
  }

  private createTagSection(container: Element, tags: string[], title: string, tagClass: string, existingTags: string[]) {
    const section = container.createEl('div', { cls: `tag-suggestion-section ${tagClass}` });
    section.createEl('h5', { text: title });

    tags.forEach(tag => {
      const tagEl = section.createEl('div', { cls: 'tag-pill', text: tag });
      tagEl.addEventListener('click', () => this.addTagToFrontMatter(tag, existingTags));
    });

    container.appendChild(section);
  }

  private addTagToFrontMatter(tag: string, existingTags: string[]) {
    this.app.fileManager.processFrontMatter(this.activeFile!, (frontmatter) => {
      if (!frontmatter.tags) {
        frontmatter.tags = [tag];
      } else if (!frontmatter.tags.includes(tag)) {
        frontmatter.tags.push(tag);
        existingTags.push(tag);
      }
    });
  }

  async onClose() {
    if (this.onFileChangeHandler) {
      this.app.workspace.off('active-leaf-change', this.onFileChangeHandler);
    }
  }
}
