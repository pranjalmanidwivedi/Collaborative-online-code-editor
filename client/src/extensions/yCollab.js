import { Compartment } from "@codemirror/state";
import { EditorView, ViewPlugin } from "@codemirror/view";
import { ySyncPlugin, yCursorPlugin, yUndoManagerPlugin } from "y-codemirror.next";

export function yCollab(yText, awareness, options = {}) {
  return [
    ySyncPlugin(yText),
    yCursorPlugin(awareness, options),
    yUndoManagerPlugin(yText)
  ];
}
