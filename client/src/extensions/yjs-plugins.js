import * as Y from 'yjs';
import { ViewPlugin } from "@codemirror/view";

/**
 * Sync Y.Text with CodeMirror.
 */
export function ySyncPlugin(yText) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this._observer = () => {
        const newText = yText.toString();
        const cursor = view.state.selection.main.head;
        view.dispatch({
          changes: {
            from: 0,
            to: view.state.doc.length,
            insert: newText
          },
          selection: { anchor: cursor }
        });
      };
      yText.observe(this._observer);
    }

    destroy() {
      yText.unobserve(this._observer);
    }
  });
}

/**
 * No-op cursor plugin (extend later)
 */
export function yCursorPlugin() {
  return [];
}

/**
 * Undo plugin stub
 */
export function yUndoManagerPlugin() {
  return [];
}
