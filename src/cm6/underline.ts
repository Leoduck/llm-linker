import {EditorView, Decoration, DecorationSet, WidgetType} from "@codemirror/view"
import {StateField, StateEffect} from "@codemirror/state"

const addUnderline = StateEffect.define<{from: number, to: number}>({
  map: ({from, to}, change) => ({from: change.mapPos(from), to: change.mapPos(to)})
})

const underlineField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(underlines, tr) {
    underlines = underlines.map(tr.changes)
    for (let e of tr.effects) if (e.is(addUnderline)) {
      underlines = underlines.update({
        add: [underlineMark.range(e.value.from, e.value.to)]
      })
    }
    return underlines
  },
  provide: f => EditorView.decorations.from(f)
})

class LinkWidget extends WidgetType {
  constructor(readonly text: string) {
    super();
  }

  toDOM() {
    const wrap = document.createElement("span");
    wrap.className = "cm-link-widget";
    
    const button = document.createElement("button");
    button.textContent = "Convert to link";
    button.className = "cm-link-button";
    button.onclick = () => {
      const editor = document.querySelector(".cm-content") as HTMLElement;
      if (editor) {
        const range = document.createRange();
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          const node = wrap.parentElement;
          if (node) {
            range.selectNodeContents(node);
            selection.addRange(range);
          }
        }
      }
    };
    
    wrap.appendChild(button);
    return wrap;
  }
}

export const underlineMark = Decoration.mark({
  class: "cm-underline",
  attributes: { title: "Click to convert to link" }
});

export const underlineTheme = EditorView.baseTheme({
  ".cm-underline": { 
    textDecoration: "underline 3px lightblue", 
    cursor: "pointer",
    position: "relative"
  },
  ".cm-link-widget": {
    position: "absolute",
    top: "-1.5em",
    left: "0",
    background: "var(--background-primary)",
    border: "1px solid var(--background-modifier-border)",
    padding: "2px 8px",
    borderRadius: "4px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    zIndex: "100",
    display: "none"
  },
  ".cm-underline:hover .cm-link-widget": {
    display: "block"
  },
  ".cm-link-button": {
    background: "var(--interactive-accent)",
    color: "var(--text-on-accent)",
    border: "none",
    padding: "2px 8px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.8em"
  },
  ".cm-link-button:hover": {
    background: "var(--interactive-accent-hover)"
  }
});

export function underlineSelection(view: EditorView) {
  let effects: StateEffect<unknown>[] = view.state.selection.ranges
    .filter(r => !r.empty)
    .map(({from, to}) => addUnderline.of({from, to}))
  if (!effects.length) return false

  if (!view.state.field(underlineField, false))
    effects.push(StateEffect.appendConfig.of([underlineField,
                                              underlineTheme]))
  view.dispatch({effects})
  return true
}

export function convertToLink(view: EditorView, from: number, to: number) {
  const text = view.state.sliceDoc(from, to);
  const linkText = `[[${text}]]`;
  view.dispatch({
    changes: {from, to, insert: linkText}
  });
}

  

