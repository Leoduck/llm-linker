import { Editor, MarkdownView, requestUrl, Notice } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { convertToLink, underlineMark, underlineTheme } from './cm6/underline';
import LLMLinkerPlugin from './main';
import { linkSuggestionPrompt } from 'prompts/linkHighlight';

// Create a regex pattern from the list of words
function createLinkPattern(linkCandidates: string[]): RegExp {
    if (linkCandidates.length === 0) linkCandidates.push('droggeljug');
    return new RegExp(`\\b(${linkCandidates.join('|')})\\b(?![^\\[]*\\])`, 'gi');
}

// Shared function to create decorations for potential links
function createLinkDecorations(
    content: string,
    getOffset: (lineIndex: number, charIndex: number) => number,
    linkCandidates: string[]
): DecorationSet {
    const lines = content.split('\n');
    const builder = new RangeSetBuilder<Decoration>();
    const pattern = createLinkPattern(linkCandidates);

    lines.forEach((line, lineIndex) => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
            const from = getOffset(lineIndex, match.index);
            const to = from + match[0].length;
            builder.add(from, to, underlineMark);
        }
    });

    return builder.finish();
}

export class LinkHighlighter {
    private editor: Editor;
    private view: MarkdownView;
    private decorations: DecorationSet = Decoration.none;
    private plugin: LLMLinkerPlugin;

    constructor(editor: Editor, view: MarkdownView, plugin: LLMLinkerPlugin) {
        this.editor = editor;
        this.view = view;
        this.plugin = plugin;
    }

    public highlightPotentialLinks(): void {
        const content = this.editor.getValue();
        const linkCandidates = this.plugin.settings.linkExisting
            ? this.plugin.settings.linkCandidates.concat(getAllNoteNames(this.plugin))
            : this.plugin.settings.linkCandidates;
        this.decorations = createLinkDecorations(
            content,
            (lineIndex, charIndex) => this.editor.posToOffset({ line: lineIndex, ch: charIndex }),
            linkCandidates
        );
    }

    public clearHighlights(): void {
        this.decorations = Decoration.none;
    }
}

// Create a CM6 extension for the underlining
export const createHighlightExtension = (plugin: LLMLinkerPlugin) => [
    underlineTheme,
    ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = Decoration.none;
                view.dom.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains('link-potential')) {
                        const pos = view.posAtDOM(target);
                        const textLength = target.textContent?.length ?? 0;
                        convertToLink(view, pos, pos + textLength);
                    }
                });
            }

            update(update: ViewUpdate) {
                if (plugin.settings.clearHighlights) {
                    this.decorations = Decoration.none;
                    return;
                }
                if (update.docChanged || update.viewportChanged) {
                    const linkCandidates = plugin.settings.linkExisting
                        ? plugin.settings.linkCandidates.concat(getAllNoteNames(plugin))
                        : plugin.settings.linkCandidates;
                    const content = update.state.doc.toString();
                    this.decorations = createLinkDecorations(
                        content,
                        (lineIndex, charIndex) => update.view.state.doc.line(lineIndex + 1).from + charIndex,
                        linkCandidates
                    );
                }
            }
        },
        {
            decorations: v => v.decorations
        }
    )
];

async function askLLMForLinkSuggestions(plugin: LLMLinkerPlugin, noteContent: string): Promise<string[]> {
    const response = await requestUrl({
        method: 'POST',
        url: plugin.settings.llmEndpoint,
        body: JSON.stringify({
            prompt: linkSuggestionPrompt(noteContent),
            model: plugin.settings.llmModel,
            stream: false,
        }),
        headers: {
            'Content-Type': 'application/json'
        }
    });
    const data = JSON.parse(response.text);
    const responseText = data.response;
    const jsonMatch = responseText.match(/\{([\s\S]*?)\}/);
    if (!jsonMatch) return [];
    return JSON.parse(jsonMatch[0]).suggestions;
}

export async function updateLinkSuggestions(plugin: LLMLinkerPlugin): Promise<string[]> {
    const activeFile = plugin.app.workspace.getActiveFile();
    if (!activeFile) {
        new Notice('No active file found.');
        return [];
    }
    const filecontent = await plugin.app.vault.read(activeFile);
    const additionalLinks = await askLLMForLinkSuggestions(plugin, filecontent);
    if (!additionalLinks) {
        console.error('No additional links found.');
        return [];
    }
    const existingLinks = plugin.settings.linkCandidates || [];
    // Merge existing link candidates with additional links, avoiding duplicates
    return existingLinks.concat(additionalLinks);
}

/**
 * Get all note names (without extension) in the Obsidian vault.
 */
export function getAllNoteNames(plugin: LLMLinkerPlugin): string[] {
    return plugin.app.vault.getMarkdownFiles().map(file => file.basename);
}
