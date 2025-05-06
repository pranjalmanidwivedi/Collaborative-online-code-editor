// main-server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import fs from 'fs';
import cors from 'cors';
import path from 'path';
import os from 'os';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { spawn } from 'child_process';
import aiRoutes from './src/routes/ai.routes.js';

dotenv.config();

const PORT = process.env.PORT || 3006;
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
app.use(cors());
app.use(helmet());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
app.use("/ai", aiRoutes);

// Routes
app.get("/", (_, res) => res.send("Hello World!"));
app.get("/health", (_, res) => res.send("OK"));

// Clean temp files
fs.readdirSync(TEMP_DIR).forEach((f) => fs.unlinkSync(path.join(TEMP_DIR, f)));

// Socket.io collaboration
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
    if (socket.dockerProcess) socket.dockerProcess.kill();
  });
});

const getAllConnectedClients = (roomId) => {
  return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => ({
    socketId,
    username: userSocketMap[socketId],
  }));
};

// Compile endpoint
app.post('/compile', async (req, res) => {
  try {
    let { code, language, socketId } = req.body;
    if (!code || !language || !socketId) return res.status(400).json({ error: 'Missing required fields' });

    language = language.toLowerCase();
    const allowed = ['python', 'cpp', 'java'];
    if (!allowed.includes(language)) return res.status(400).json({ error: 'Unsupported language' });

    const fileMap = {
      python: ['Main.py'],
      cpp: ['Main.cpp', 'a.out'],
      java: ['Main.java', 'Main.class']
    };
    const fileName = fileMap[language][0];

    const tempDir = path.join(TEMP_DIR, socketId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);
    fs.writeFileSync(path.join(tempDir, fileName), code);

    const dockerProcess = spawn('docker', [
      'run', '-i', '--rm', '--network=none',
      '-v', `${tempDir}:/code`, '--workdir', '/code', `codebridge-${language}`
    ]);

    const socket = io.sockets.sockets.get(socketId);
    if (socket) socket.dockerProcess = dockerProcess;
    else dockerProcess.kill();

    const timeout = setTimeout(() => {
      dockerProcess.kill();
      socket?.emit('program-output', {
        output: '\n***********Process Terminated: Time Limit Exceeded (1 minute)***********\n'
      });
    }, 60000);

    res.json({ status: 'started', socketId });

    dockerProcess.stdout.on('data', (data) => socket?.emit('program-output', { output: data.toString() }));
    dockerProcess.stderr.on('data', (data) => socket?.emit('program-output', { output: data.toString() }));
    dockerProcess.on('exit', () => {
      clearTimeout(timeout);
      socket?.emit('program-output', { output: '\n***********Execution Complete***********\n' });
      fileMap[language].forEach(f => {
        const file = path.join(tempDir, f);
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  } catch (e) {
    console.error('Compile error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`🚀 Main app running at http://${HOST}:${PORT}`);
});
