// src/extensions/yjs-plugins.js
import * as Y from 'yjs';
import { ViewPlugin } from '@codemirror/view';
import { keymap } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';

/**
 * Sync Yjs text with CodeMirror.
 */
export function ySyncPlugin(yText) {
  return ViewPlugin.fromClass(class {
    constructor(view) {
      this.view = view;

      this._observer = () => {
        const text = yText.toString();
        const cursor = view.state.selection.main.head;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
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

/**
 * Dummy cursor plugin (you can extend later).
 */
export function yCursorPlugin() {
  return [];
}

/**
 * Simple undo manager.
 */
export function yUndoManagerPlugin(yText) {
  const undoManager = new Y.UndoManager(yText);

  return keymap.of([
    { key: 'Mod-z', run: () => undoManager.undo() || true },
    { key: 'Mod-y', run: () => undoManager.redo() || true },
    { key: 'Mod-Shift-z', run: () => undoManager.redo() || true }
  ]);
}
