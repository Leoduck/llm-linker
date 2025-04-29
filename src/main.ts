import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { TagView, VIEW_TYPE_TAGGING } from './tagview';
import { createHighlightExtension } from './highlight';
import { sectionHighlightExtension } from './cm6/sectionhighlighter';
// Remember to rename these classes and interfaces!

interface LLMLinkerPluginSettings {
	mySetting: string;
	linkCandidates: string[];
}

const DEFAULT_SETTINGS: LLMLinkerPluginSettings = {
	mySetting: 'default',
	linkCandidates: [
		'Project',
		'Task',
		'Meeting',
		'Document',
		'Note',
		'Person',
		'Team',
		'Goal',
		'HCAI',
		'Milestone',
		'Deadline',
		'serves'
	]
}

export default class LLMLinkerPlugin extends Plugin {
	settings: LLMLinkerPluginSettings;

	async onload() {
		// Load plugin settings
		await this.loadSettings();

		// Register the CM6 extensions
		this.registerEditorExtension(createHighlightExtension(this));
		//this.registerEditorExtension(sectionHighlightExtension);

		this.registerView(
			VIEW_TYPE_TAGGING,
			(leaf) => new TagView(leaf)
		);

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('tags', 'open tagging window', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('tag');
			this.activateView();
		});

		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'generate-tags',
			name: 'Generate Tags for current note',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				editor.replaceSelection('Sample Editor Command');
			}
		});

		// Add command to highlight potential links
		this.addCommand({
			id: 'highlight-potential-links',
			name: 'Highlight potential links',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				new Notice('Potential links highlighted');
			}
		});

		// Add command to highlight a section
		//this.addCommand({
		//	id: 'highlight-section',
		//	name: 'Highlight current section',
		//	editorCallback: (editor: Editor, view: MarkdownView) => {
		//		const cursor = editor.getCursor();
		//		const line = editor.getLine(cursor.line);
		//		
		//		// Just notify that highlighting is active
		//		new Notice('Sections between "Examples include" and "people effectively" will be highlighted');
		//	}
		//});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		// this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async activateView() {
		const { workspace } = this.app;

		let leaf: WorkspaceLeaf;
		const leaves = workspace.getLeavesOfType(VIEW_TYPE_TAGGING);

		if (leaves.length > 0) {
			// A leaf with our view already exists, use that
			leaf = leaves[0];
		} else {
			// Our view could not be found in the workspace, create a new leaf
			// in the right sidebar for it
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: VIEW_TYPE_TAGGING, active: true });
		}

		// "Reveal" the leaf in case it is in a collapsed sidebar
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
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Link Candidates')
			.setDesc('Words that should be highlighted as potential links (one per line), names of notes are automatically added')
			.addTextArea(text => text
				.setPlaceholder('Enter words to highlight')
				.setValue(this.plugin.settings.linkCandidates.join('\n'))
				.onChange(async (value) => {
					this.plugin.settings.linkCandidates = value.split('\n').filter(word => word.trim() !== '');
					await this.plugin.saveSettings();
				}));
	}
}
