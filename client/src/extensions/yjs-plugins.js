// src/extensions/yjs-plugins.js
import * as Y from 'yjs';
import { EditorView, Decoration, DecorationSet, ViewPlugin } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

// YSyncPlugin: binds CodeMirror document with Y.Text
export function ySyncPlugin(yText) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;

      this._observer = () => {
        const text = yText.toString();
        const cursor = this.view.state.selection.main.head;
        this.view.dispatch({
          changes: { from: 0, to: this.view.state.doc.length, insert: text },
          selection: { anchor: cursor },
        });
      };

      yText.observe(this._observer);
    }

    destroy() {
      yText.unobserve(this._observer);
    }
  });
}

// YCursorPlugin: handles awareness cursors
export function yCursorPlugin(awareness) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.decorations = Decoration.none;

      this._update = () => {
        const builder = [];
        for (let [clientId, state] of awareness.getStates()) {
          if (!state.cursor) continue;

          const deco = Decoration.widget({
            widget: {
              toDOM: () => {
                const span = document.createElement("span");
                span.className = "yjs-cursor";
                span.textContent = state.user?.name || "User";
                span.style.color = state.user?.color || "blue";
                return span;
              },
            },
            side: -1
          }).range(state.cursor);
          builder.push(deco);
        }
        this.decorations = Decoration.set(builder, true);
      };

      awareness.on("change", this._update);
      this._update();
    }

    destroy() {
      awareness.off("change", this._update);
    }

    update() {
      this._update();
    }

    get decorations() {
      return this.decorations;
    }
  }, {
    decorations: v => v.decorations
  });
}

// YUndoPlugin: tracks undo/redo
export function yUndoManagerPlugin(yText) {
  const undoManager = new Y.UndoManager(yText);

  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;
      this.undo = () => undoManager.undo();
      this.redo = () => undoManager.redo();
    }

    destroy() { }
  });
}
