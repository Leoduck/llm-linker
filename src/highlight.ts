import { Editor, MarkdownView } from 'obsidian';
import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { convertToLink, underlineMark, underlineTheme } from './cm6/underline';

export class LinkHighlighter {
    private editor: Editor;
    private view: MarkdownView;
    private decorations: DecorationSet = Decoration.none;

    constructor(editor: Editor, view: MarkdownView) {
        this.editor = editor;
        this.view = view;
    }

    public highlightPotentialLinks(): void {
        const content = this.editor.getValue();
        const lines = content.split('\n');
        
        // Regular expression to find potential link candidates
        const potentialLinkRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
        
        const builder = new RangeSetBuilder<Decoration>();
        
        // Process each line
        lines.forEach((line, lineIndex) => {
            let match;
            while ((match = potentialLinkRegex.exec(line)) !== null) {
                const [fullMatch, word] = match;
                const from = this.editor.posToOffset({ line: lineIndex, ch: match.index });
                const to = from + fullMatch.length;
                builder.add(from, to, underlineMark);
            }
        });
        
        this.decorations = builder.finish();
    }

    public clearHighlights(): void {
        this.decorations = Decoration.none;
    }
}

// Create a CM6 extension for the underlining
export const highlightExtension = [
    underlineTheme,
    ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = Decoration.none;
                
                // Add click handler for underlined text
                view.dom.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    if (target.classList.contains('cm-underline')) {
                        const pos = view.posAtDOM(target);
                        const textLength = target.textContent?.length ?? 0;
                        convertToLink(view, pos, pos + textLength);
                    }
                });
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    // Recalculate decorations when content changes
                    const content = update.state.doc.toString();
                    const lines = content.split('\n');
                    const builder = new RangeSetBuilder<Decoration>();
                    
                    const potentialLinkRegex = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g;
                    
                    lines.forEach((line, lineIndex) => {
                        let match;
                        while ((match = potentialLinkRegex.exec(line)) !== null) {
                            const [fullMatch, word] = match;
                            const from = update.view.state.doc.line(lineIndex + 1).from + match.index;
                            const to = from + fullMatch.length;
                            
                            builder.add(from, to, underlineMark);
                        }
                    });
                    
                    this.decorations = builder.finish();
                }
            }
        },
        {
            decorations: v => v.decorations
        }
    )
];
