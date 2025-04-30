import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import { spawn } from 'child_process';
import cors from 'cors';
import path from 'path';
import os from 'os';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { WebSocketServer } from 'ws';
import { setupWSConnection } from 'y-websocket/bin/utils.js';
import aiRoutes from './src/routes/ai.routes.js';

dotenv.config();

const PORT = process.env.PORT || 3005;
const HOST = "0.0.0.0";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

const TEMP_DIR = path.join(os.tmpdir(), 'code_bridge_temp');
const userSocketMap = {};

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// Middleware
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'], credentials: true }));
app.use(helmet());

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use(limiter);
app.use("/ai", aiRoutes);

app.get("/", (req, res) => res.send("Hello World!"));
app.get("/health", (req, res) => res.send("OK"));

// Clean temp files on boot
fs.readdirSync(TEMP_DIR).forEach((file) => {
  const filePath = path.join(TEMP_DIR, file);
  fs.unlinkSync(filePath);
});

// ------------------ Socket.IO Collaboration ------------------
io.on("connection", (socket) => {
  socket.on("join", ({ roomId, username }) => {
    userSocketMap[socket.id] = username;
    socket.join(roomId);

    const clients = getAllConnectedClients(roomId);
    if (clients.length > 1) {
      socket.broadcast.to(roomId).emit("request-code-sync", { socketId: socket.id });
    }

    clients.forEach(({ socketId }) => {
      io.to(socketId).emit("joined", { clients, username, socketId: socket.id });
    });
  });

  socket.on("sync-code", ({ code, socketId }) => {
    io.to(socketId).emit("sync-code", { code });
  });

  socket.on("code-change", ({ roomId, code }) => {
    socket.in(roomId).emit("code-change", { code });
  });

  socket.on("program-input", (input) => {
    if (socket.dockerProcess) {
      socket.dockerProcess.stdin.write(input + '\n');
      socket.emit('program-output', { output: "\n" });
    }
  });

  socket.on("disconnecting", () => {
    const rooms = [...socket.rooms];
    rooms.forEach((roomId) => {
      socket.in(roomId).emit("disconnected", {
        socketId: socket.id,
        username: userSocketMap[socket.id],
      });
    });
    delete userSocketMap[socket.id];
  });

  socket.on("disconnect", () => {
    if (socket.dockerProcess) {
      socket.dockerProcess.kill();
    }
  });
});

const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
};

// ------------------ Code Compiler Endpoint ------------------
app.post('/compile', async (req, res) => {
  try {
    let { code, language, socketId } = req.body;
    if (!code || !language || !socketId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    language = language.toLowerCase();
    const allowedLanguages = ['python', 'cpp', 'java'];
    if (!allowedLanguages.includes(language)) {
      return res.status(400).json({ error: 'Unsupported language' });
    }

    const fileNames = {
      python: ['Main.py'],
      cpp: ['Main.cpp', 'a.out'],
      java: ['Main.java', 'Main.class']
    };
    const fileName = fileNames[language][0];

    const uniqueTempDir = path.join(TEMP_DIR, socketId);
    if (!fs.existsSync(uniqueTempDir)) fs.mkdirSync(uniqueTempDir);

    const filePath = path.join(uniqueTempDir, fileName);
    fs.writeFileSync(filePath, code);

    const dockerImage = `codebridge-${language}`;
    const dockerProcess = spawn('docker', [
      'run',
      '-i',
      '--rm',
      '--network=none',
      '-v', `${uniqueTempDir}:/code`,
      '--workdir', '/code',
      dockerImage
    ]);

    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.dockerProcess = dockerProcess;
    else dockerProcess.kill();

    const timeout = setTimeout(() => {
      if (dockerProcess) {
        dockerProcess.kill();
        if (socket) {
          socket.emit('program-output', {
            output: '\n***********Process Terminated: Time Limit Exceeded (1 minute)***********\n'
          });
        }
      }
    }, 60000);

    res.json({ status: 'started', socketId });

    dockerProcess.stdout.on('data', (data) => {
      if (socket) socket.emit('program-output', { output: data.toString() });
    });

    dockerProcess.stderr.on('data', (data) => {
      if (socket) socket.emit('program-output', { output: data.toString() });
    });

    dockerProcess.on('exit', () => {
      clearTimeout(timeout);
      if (socket) {
        socket.emit('program-output', {
          output: '\n***********Execution Complete***********\n'
        });
      }
      fileNames[language].forEach(f => {
        const fileToDelete = path.join(uniqueTempDir, f);
        if (fs.existsSync(fileToDelete)) fs.unlinkSync(fileToDelete);
      });
      fs.rmSync(uniqueTempDir, { recursive: true, force: true });
    });

  } catch (error) {
    console.error('Compilation error:', error);
    res.status(500).json({ error: 'Internal server error during compilation' });
  }
});

// ------------------ Yjs WebSocket on Shared Server ------------------
const yjsWSS = new WebSocketServer({ noServer: true });


server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);

  if (pathname === '/yjs') {
    yjsWSS.handleUpgrade(request, socket, head, (ws) => {
      setupWSConnection(ws, request);
    });
  }
});


console.log("✅ Yjs WebSocket running on main server");

// ------------------ Start Server ------------------
server.listen(PORT, HOST, () => {
  console.log(`🚀 Main app running at http://${HOST}:${PORT}`);
});
