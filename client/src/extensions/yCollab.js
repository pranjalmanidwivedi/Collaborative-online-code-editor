import { keymap } from "@codemirror/view";
import { undo, redo } from "@codemirror/commands";
import { ySyncPlugin, yCursorPlugin, yUndoManagerPlugin } from "./yjs-plugins";

export function yCollab(yText, awareness) {
  return [
    ySyncPlugin(yText),
    yCursorPlugin(awareness),
    yUndoManagerPlugin(yText),
    keymap.of([
      { key: "Mod-z", run: undo },
      { key: "Mod-y", run: redo },
      { key: "Mod-Shift-z", run: redo }
    ])
  ];
}
