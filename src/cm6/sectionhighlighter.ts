import { EditorView, Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Create a decoration for highlighted sections with a modern style
const sectionHighlightLine = Decoration.line({
    attributes: {
        class: 'section-highlight',
        title: "This section presents a clear, step-by-step process that users can reference when applying the Zettelkasten method. Splitting it into its own note allows for easy access and integration into other notes about practical applications of the method.",
        style: `
            border-left: 2px solid rgba(255, 255, 0, 0.5);
            padding: 2px;
            background-color: rgba(255, 166, 0, 0.1);
            cursor: pointer;
        `
    }
});

// Highlight from start marker to end marker, covering full lines
function createSectionDecorations(content: string, getOffset: (lineIndex: number, charIndex: number) => number): DecorationSet {
    const lines = content.split('\n');
    const builder = new RangeSetBuilder<Decoration>();
    const startMarker = "### Workflow";
    const endMarker = "or create new connections as your understanding evolves.";

    let isHighlighting = false;

    lines.forEach((line, lineIndex) => {
        if (line.includes(startMarker)) {
            isHighlighting = true;
        }
        if (isHighlighting) {
            // Highlight the entire line
            const lineStart = getOffset(lineIndex, 0);
            builder.add(lineStart, lineStart, sectionHighlightLine);
        }
        if (line.includes(endMarker) && isHighlighting) {
            isHighlighting = false;
        }
    });

    return builder.finish();
}

// Accepts an array of section boundaries and highlights each section
export function createSectionDecorationsFromBoundaries(
    content: string,
    getOffset: (lineIndex: number, charIndex: number) => number,
    boundaries: { section_start: string; section_end: string }[]
): DecorationSet {
    const lines = content.split('\n');
    const builder = new RangeSetBuilder<Decoration>();

    boundaries.forEach(({ section_start, section_end }) => {
        let startLine = -1;
        let endLine = -1;
        // Find the line containing the start and end markers
        for (let i = 0; i < lines.length; i++) {
            if (startLine === -1 && lines[i].includes(section_start)) {
                startLine = i;
            }
            if (lines[i].includes(section_end)) {
                endLine = i;
            }
        }
        if (startLine !== -1 && endLine !== -1 && endLine >= startLine) {
            for (let i = startLine; i <= endLine; i++) {
                const lineStart = getOffset(i, 0);
                builder.add(lineStart, lineStart, sectionHighlightLine);
            }
        }
    });
    return builder.finish();
}

// CM6 extension for section highlighting
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
