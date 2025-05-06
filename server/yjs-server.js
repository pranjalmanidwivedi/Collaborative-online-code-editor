// yjs-server.js
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils.js';

const PORT = 3005;
const wss = new WebSocketServer({ port: PORT });

wss.on('connection', (conn, req) => {
  setupWSConnection(conn, req);
});

console.log(`✅ Yjs WebSocket server running at ws://localhost:${PORT}`);
