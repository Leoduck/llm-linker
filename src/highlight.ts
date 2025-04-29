import { Editor, MarkdownView } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { convertToLink, underlineMark, underlineTheme } from './cm6/underline';
import LLMLinkerPlugin from './main';

// Create a regex pattern from the list of words
function createLinkPattern(linkCandidates: string[]): RegExp {
    return new RegExp(`\\b(${linkCandidates.join('|')})\\b(?![^\\[]*\\])`, 'gi');
}

// Shared function to create decorations for potential links
function createLinkDecorations(content: string, getOffset: (lineIndex: number, charIndex: number) => number, linkCandidates: string[]): DecorationSet {
    const lines = content.split('\n');
    const builder = new RangeSetBuilder<Decoration>();
    const pattern = createLinkPattern(linkCandidates);
    
    lines.forEach((line, lineIndex) => {
        let match;
        while ((match = pattern.exec(line)) !== null) {
            // Check if the match is not part of a link
            const beforeMatch = line.slice(0, match.index);
            const afterMatch = line.slice(match.index + match[0].length);
            
            const [fullMatch] = match;
            const from = getOffset(lineIndex, match.index);
            const to = from + fullMatch.length;
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
        this.decorations = createLinkDecorations(
            content,
            (lineIndex, charIndex) => this.editor.posToOffset({ line: lineIndex, ch: charIndex }),
            this.plugin.settings.linkCandidates
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
                
                // Add click handler for underlined text
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
                if (update.docChanged || update.viewportChanged) {
                    const content = update.state.doc.toString();
                    this.decorations = createLinkDecorations(
                        content,
                        (lineIndex, charIndex) => update.view.state.doc.line(lineIndex + 1).from + charIndex,
                        plugin.settings.linkCandidates
                    );
                }
            }
        },
        {
            decorations: v => v.decorations
        }
    )
];
