import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Create a decoration for highlighted sections with a more modern style
const sectionHighlightMark = Decoration.mark({
    class: 'section-highlight',
    attributes: { 
        style: `
            border-radius: 4px; /* Rounded corners */
            padding: 2px; /* Padding inside the box */
            background-color: rgba(255, 255, 0, 0.1); /* Light yellow background */
        `
    }
});

// Function to create decorations for highlighted sections
function createSectionDecorations(content: string, getOffset: (lineIndex: number, charIndex: number) => number): DecorationSet {
    const lines = content.split('\n');
    const builder = new RangeSetBuilder<Decoration>();
    
    const startMarker = '**Hufflepuff** was one';
    const endMarker = 'in its members';
    
    let isHighlighting = false;
    let startPos = 0;

    lines.forEach((line, lineIndex) => {
        if (line.includes(startMarker)) {
            isHighlighting = true;
            // Start highlighting from the beginning of this line
            startPos = getOffset(lineIndex, 0);
        }

        if (line.includes(endMarker) && isHighlighting) {
            // End highlighting at the end of this line
            const endPos = getOffset(lineIndex, line.length);
            if (endPos > startPos) {  // Only add if we have content to highlight
                builder.add(startPos, endPos, sectionHighlightMark);
            }
            isHighlighting = false;
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
