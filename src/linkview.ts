import { ItemView, WorkspaceLeaf, Notice, requestUrl, Vault, TFile } from 'obsidian';
import { linksuggestPrompt } from '../prompts/linksuggest';
import LLMLinkerPlugin from './main';

export const VIEW_TYPE_LINKING = 'link-view';

interface LinkSuggestion {
    title: string;
    kickstarter: string;
    connection: string;
};

export class LinkView extends ItemView {
  private activeFile: any;
  private onFileChangeHandler: () => void;
  private plugin: LLMLinkerPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: LLMLinkerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_LINKING;
  }

  getDisplayText() {
    return 'Link view';
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
        this.renderViewLink(container);
      }
    };

    this.app.workspace.on('active-leaf-change', this.onFileChangeHandler);
  }

  async renderViewLink(container: Element) {
    container.createEl('h4', { text: 'Link suggestions' });

    if (!this.activeFile) {
      container.createEl('p', { text: 'No active note is open.' });
      return;
    }

    const contentEl = container.createEl('div', { cls: 'note-content' });
    const llmButton = this.createLLMButton(contentEl);
  }

  private createLLMButton(container: Element): HTMLElement {
    const llmButton = container.createEl('button', { cls: 'generate-links-button', text: 'Ask LLM for links' });
    llmButton.addEventListener('click', () => this.handleLLMRequest(container));
    return llmButton;
  }

  private async handleLLMRequest(container: Element) {
    const spinner = this.createLoadingSpinner(container);
    const fileContent = await this.app.vault.read(this.activeFile);

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
  
  private async requestLinkSuggestions(fileContent: string): Promise<LinkSuggestion[]> {
    // dummy for testint
    const responseText = `Here is the JSON response:\n\`\`\`json\n{
        "suggestions": [ { "title": "The Role of Values in AI Design", "kickstarter": "How do we concretely translate values like fairness, inclusivity, and privacy into actionable design principles for AI systems? Let's examine frameworks and methodologies for embedding ethical considerations throughout the AI development lifecycle.", "connection": "This expands on the 'Ethics' point within HCAI, diving deeper into the practical challenges of aligning AI with human values." },
            {
            "title": "Human-AI Collaboration Models",
            "kickstarter": "Beyond simply 'staying in the loop,' what are the most effective models for human-AI collaboration in different domains? Let’s explore different interaction paradigms and their impact on user experience and AI performance.",
            "connection": "This builds upon the emphasis on 'control' and collaboration in HCAI, suggesting specific models for achieving those goals."
            }
        ]
        }\n\`\`\`\nAdditional notes: This JSON provides suggestions for HCAI topics.`;
    //const response = await requestUrl({
    //  method: 'POST',
    //  url: this.plugin.settings.llmEndpoint,
    //  body: JSON.stringify({
    //    prompt: linksuggestPrompt(fileContent),
    //    model: this.plugin.settings.llmModel,
    //    stream: false,
    //  }),
    //  headers: {
    //    'Content-Type': 'application/json'
    //  }
    //});
    //console.log('LLM response:', response.text);
    //const data = JSON.parse(response.text);
    //const responseText = data.response;
    const jsonMatch = responseText.match(/\{([\s\S]*)\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse suggestions from LLM response');
    }

    return JSON.parse(jsonMatch[0]).suggestions;
  }

  private displayLinkSuggestions(container: Element, suggestions: LinkSuggestion[]) {
    if (suggestions.length < 1) {
      new Notice('No new suggestions found.');
      return;
    }

    const suggestionsEl = container.createEl('div', { cls: 'llm-suggestions' });

    suggestions.forEach(suggestion => {
      const suggestionEl = suggestionsEl.createEl('div', { cls: 'link-suggestion' });
      suggestionEl.createEl('h5', { text: suggestion.title });
      suggestionEl.createEl('p', { text: suggestion.kickstarter });
      suggestionEl.createEl('small', { text: `Connection: ${suggestion.connection}` });

      suggestionEl.addEventListener('click', async () => {
        const linkText = `[[${suggestion.title}]]`;
        const newNotePath = `${suggestion.title}.md`;

        const fileContent = await this.app.vault.read(this.activeFile);
        // Append the link to the current note
        await this.app.vault.modify(this.activeFile, fileContent + '\n' + linkText);
        new Notice(`Added link: ${linkText}`);

        // Create a new note with the suggestion's kickstarter as content
        if (!this.app.vault.getAbstractFileByPath(newNotePath)) {
          await this.app.vault.create(newNotePath, suggestion.kickstarter);
          new Notice(`Created new note: ${newNotePath}`);
        } else {
          new Notice(`Note already exists: ${newNotePath}`);
        }
      });
    });
  }

  async onClose() {
    if (this.onFileChangeHandler) {
      this.app.workspace.off('active-leaf-change', this.onFileChangeHandler);
    }
  }
}
