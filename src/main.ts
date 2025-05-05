import { App, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { TagView, VIEW_TYPE_TAGGING } from './tagview';
import { createHighlightExtension, updateLinkSuggestions } from './highlight';
import { sectionHighlightExtension } from './cm6/sectionhighlighter';

interface LLMLinkerPluginSettings {
	linkCandidates: string[];
	linkExclusions: string[];
	llmEndpoint: string;
	llmModel: string;
	apiKey: string;
	autoLink: boolean;
	linkExisting: boolean;
	clearHighlights: boolean;
}

const DEFAULT_SETTINGS: LLMLinkerPluginSettings = {
	linkCandidates: ['Link1', 'Link2', 'Link phrase of words'],
	llmEndpoint: 'http://localhost:11434/api/generate',
	llmModel: 'gemma3:12b',
	apiKey: '',
	autoLink: false,
	linkExisting: true,
	clearHighlights: false
};

export default class LLMLinkerPlugin extends Plugin {
	settings: LLMLinkerPluginSettings;

	async onload() {
		await this.loadSettings();

		this.registerEditorExtension(createHighlightExtension(this));
		this.registerEditorExtension(sectionHighlightExtension);

		this.registerView(VIEW_TYPE_TAGGING, (leaf) => new TagView(leaf, this));

		this.addRibbonIcon('tags', 'open tagging window', () => this.activateView())
			.addClass('my-plugin-ribbon-class');

		this.addSettingTab(new SampleSettingTab(this.app, this));

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.addCommand({
			id: 'update-link-suggestions',
			name: 'Update Link Suggestions',
			callback: async () => {
				const newLinks = await updateLinkSuggestions(this);
				if (newLinks.length === 0) {
					new Notice('No new links found');
					return;
				}
				this.settings.linkCandidates = newLinks;
				await this.saveSettings();
				new Notice('Link suggestions updated');
			}
		});
		this.addCommand({
			id: 'get-all-note-titles',
			name: 'All note titles',
			callback: async () => {
				console.log('All note titles:', this.app.vault.getMarkdownFiles().map(file => file.basename));
			}
		});
		this.addCommand({
			id: 'get-section-boundaries',
			name: 'Get Section Boundaries (LLM)',
			callback: async () => {
				const activeFile = this.app.workspace.getActiveFile();
				if (!activeFile) {
					new Notice('No active file found.');
					return;
				}
				const content = await this.app.vault.read(activeFile);
				const { llmEndpoint, llmModel, apiKey } = this.settings;
				const { getSectionBoundariesFromLLM } = await import('./sectionllm');
				const boundaries = await getSectionBoundariesFromLLM(llmEndpoint, llmModel, apiKey, content);
				console.log('Section boundaries from LLM:', boundaries);
				new Notice(`Found ${boundaries.length} section${boundaries.length === 1 ? '' : 's'} (see console).`);
			}
		});
	}

	onunload() {}

	async activateView() {
		const { workspace } = this.app;
		let leaf: WorkspaceLeaf;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_TAGGING);

		if (leaves.length > 0) {
			leaf = leaves[0];
		} else {
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_TAGGING, active: true });
		}
		workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: LLMLinkerPlugin;

	constructor(app: App, plugin: LLMLinkerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('LLM Endpoint')
			.setDesc('The API endpoint for the LLM service')
			.addText(text => text
				.setPlaceholder('Enter LLM endpoint URL')
				.setValue(this.plugin.settings.llmEndpoint)
				.onChange(async (value) => {
					this.plugin.settings.llmEndpoint = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('LLM Model')
			.setDesc('The model to use for LLM completions')
			.addText(text => text
				.setPlaceholder('Enter model name')
				.setValue(this.plugin.settings.llmModel)
				.onChange(async (value) => {
					this.plugin.settings.llmModel = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Api Key')
			.setDesc('The API key for the LLM service')
			.addText(text => text
				.setPlaceholder('Enter API key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Highlight conversion')
			.setDesc('Convert highlighted text to links automatically')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.autoLink)
					.onChange(async (value) => {
						this.plugin.settings.autoLink = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Link Candidates')
			.setDesc('Words that should be highlighted as potential links (one per line), names of notes are automatically added')
			.addTextArea(text => {
				text.inputEl.rows = 8;
				text
					.setPlaceholder('Enter words to highlight')
					.setValue(this.plugin.settings.linkCandidates.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.linkCandidates = value.split('\n').filter(word => word.trim() !== '');
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Vault note links')
			.setDesc('Highlight words that are the names of notes in the vault')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.linkExisting)
					.onChange(async (value) => {
						this.plugin.settings.linkExisting = value;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Clear Highlights')
			.setDesc('Temporarily hide all link highlights in the editor')
			.addToggle(toggle => {
				toggle
					.setValue(this.plugin.settings.clearHighlights)
					.onChange(async (value) => {
						this.plugin.settings.clearHighlights = value;
						await this.plugin.saveSettings();
					});
			});
		new Setting(containerEl)
			.setName('Exlude these notes from prompts')
			.setDesc('Notes that should not be included in the LLM prompt')
			.addTextArea(text => {
				text.inputEl.rows = 8;
				text
					.setPlaceholder('Enter notes or directories to exclude')
					.setValue(this.plugin.settings.linkExclusions.join('\n'))
					.onChange(async (value) => {
						this.plugin.settings.linkExclusions = value.split('\n').filter(word => word.trim() !== '');
						await this.plugin.saveSettings();
					}
				);
			});
	}
}
