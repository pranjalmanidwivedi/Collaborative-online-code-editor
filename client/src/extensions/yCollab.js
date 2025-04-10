import { ySyncPlugin, yCursorPlugin, yUndoManagerPlugin } from 'y-codemirror.next/yjs';
import { keymap } from "@codemirror/view";
import { undo, redo } from "y-codemirror.next/yjs";

export function yCollab(yText, awareness) {
  return [
    ySyncPlugin(yText),
    yCursorPlugin(awareness),
    yUndoManagerPlugin(yText),
    keymap.of([
      { key: "Mod-z", run: undo },
      { key: "Mod-y", run: redo },
      { key: "Mod-Shift-z", run: redo },
    ])
  ];
}
