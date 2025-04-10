// src/yjs/yjs-setup.js
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export function createYjsProvider(roomId) {
  const ydoc = new Y.Doc();
  const provider = new WebsocketProvider(
    'wss://demos.yjs.dev',
    roomId,
    ydoc
  );

  const yText = ydoc.getText('codemirror');

  provider.awareness.setLocalStateField('user', {
    name: 'Guest',
    color: '#' + Math.floor(Math.random() * 16777215).toString(16),
  });

  return { provider, yText, awareness: provider.awareness };
}
