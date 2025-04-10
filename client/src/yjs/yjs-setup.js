import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export const ydoc = new Y.Doc();

export const provider = new WebsocketProvider(
  'wss://demos.yjs.dev',  // or 'ws://localhost:1234' if running locally
  'code-room-1',          // this should be dynamic if supporting multiple rooms
  ydoc
);

export const yText = ydoc.getText('codemirror');

export const awareness = provider.awareness;

