import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Create a decoration for highlighted sections with a more modern style
const sectionHighlightMark = Decoration.mark({
    class: 'section-highlight',
    attributes: { 
        style: `
            background-color: rgba(255, 255, 0, 0.1);
            border-left: 3px solid rgba(255, 200, 0, 0.5);
            margin-left: -3px;
            padding-left: 3px;
            border-radius: 0 2px 2px 0;
            display: block;
            width: 100%;
            box-sizing: border-box;
        `
    }
});

// Function to create decorations for highlighted sections
function createSectionDecorations(content: string, getOffset: (lineIndex: number, charIndex: number) => number): DecorationSet {
    const lines = content.split('\n');
    const builder = new RangeSetBuilder<Decoration>();
    
    const startMarker = 'Examples include';
    const endMarker = 'people effectively';
    
    let isHighlighting = false;
    let startPos = 0;
    
    lines.forEach((line, lineIndex) => {
        if (line.includes(startMarker)) {
            isHighlighting = true;
            // Start highlighting from the beginning of this line
            startPos = getOffset(lineIndex, 0);
        } else if (line.includes(endMarker)) {
            if (isHighlighting) {
                // End highlighting at the end of this line
                const endPos = getOffset(lineIndex, line.length);
                if (endPos > startPos) {  // Only add if we have content to highlight
                    builder.add(startPos, endPos, sectionHighlightMark);
                }
                isHighlighting = false;
            }
        } else if (isHighlighting) {
            // If we're in a section, highlight the entire line
            const from = getOffset(lineIndex, 0);
            const to = getOffset(lineIndex, line.length);
            builder.add(from, to, sectionHighlightMark);
        }
    });
    
    return builder.finish();
}

// Create a CM6 extension for section highlighting
export const sectionHighlightExtension = [
    ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = Decoration.none;
            }

            update(update: ViewUpdate) {
                if (update.docChanged || update.viewportChanged) {
                    const content = update.state.doc.toString();
                    this.decorations = createSectionDecorations(
                        content,
                        (lineIndex, charIndex) => update.view.state.doc.line(lineIndex + 1).from + charIndex
                    );
                }
            }
        },
        {
            decorations: v => v.decorations
        }
    )
];
