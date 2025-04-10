import { ySyncPlugin, yCursorPlugin, yUndoManagerPlugin } from './yjs-plugins';

export function yCollab(yText, awareness) {
  return [
    ySyncPlugin(yText),
    ...yCursorPlugin(awareness),
    ...yUndoManagerPlugin(yText)
  ];
}
