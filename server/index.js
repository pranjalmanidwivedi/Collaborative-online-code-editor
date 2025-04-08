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
import aiRoutes from './src/routes/ai.routes.js'

dotenv.config();



const PORT = process.env.PORT || 3005;
const HOST = "0.0.0.0";
const app = express();
app.use(express.json());
app.use(cors({
    origin: "*",  // Allow all origins (for testing)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(helmet());

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
});
app.use(limiter);

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.use("/ai", aiRoutes);

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
      origin: "*", // Or specify the exact origin
      methods: ["GET", "POST"]
    }
  });

const userSocketMap = {};

const TEMP_DIR = path.join(os.tmpdir(), 'code_bridge_temp');


if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR);
}

const cleanTempDirectory = () => {
    try {
        const files = fs.readdirSync(TEMP_DIR);
        for (const file of files) {
            const filePath = path.join(TEMP_DIR, file);
            fs.unlinkSync(filePath);
            console.log(`Cleaned up file: ${filePath}`);
        }
    } catch (err) {
        console.error('Error cleaning temp directory:', err);
    }
};

cleanTempDirectory();

io.on("connection", (socket) => {
    socket.on("join", ({ roomId, username }) => {
        userSocketMap[socket.id] = username;
        socket.join(roomId);
        const clients = getAllConnectedClients(roomId);
        clients.forEach(({ socketId }) => {
            io.to(socketId).emit("joined", {
                clients,
                username,
                socketId: socket.id
            });
        });
    });

    socket.on("code-change", ({ roomId, code }) => {
        socket.in(roomId).emit("code-change", { code });
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        rooms.forEach((roomId) => {
            socket.in(roomId).emit("disconnected", {
                socketId: socket.id,
                username: userSocketMap[socket.id]
            });
        });
        delete userSocketMap[socket.id];
        socket.leave();
    });

    socket.on("program-input", (input) => {
        if (socket.dockerProcess) {
            socket.dockerProcess.stdin.write(input + '\n');
            socket.emit('program-output', {
                output: "\n"
            });
        }
    });

    socket.on("disconnect", () => {
        if (socket.dockerProcess) {
            socket.dockerProcess.kill();
        }
    });
});

const getAllConnectedClients = (roomId) => {
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map((socketId) => {
        return {
            socketId,
            username: userSocketMap[socketId]
        };
    });
};

app.post('/compile', async (req, res) => {
    try {
        let { code, language, socketId } = req.body;
        console.log('Received compile request:', { language, socketId });

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
        const filesToCleanup = fileNames[language];
        const fileName = filesToCleanup[0];

        const uniqueTempDir = path.join(TEMP_DIR, socketId);
        if (!fs.existsSync(uniqueTempDir)) {
            fs.mkdirSync(uniqueTempDir);
        }

        const filePath = path.join(uniqueTempDir, fileName);
        fs.writeFileSync(filePath, code);

        const dockerImage = `codebridge-${language}`;
        const dockerProcess = spawn('docker', [
            'run',
            '-i',
            '--rm',
            '--network=none',
            '-v',
            `${uniqueTempDir}:/code`,
            '--workdir',
            '/code',
            dockerImage
        ])
        .on('error', (err) => {
            console.error('Docker spawn failed:', err);
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('program-output', {
                    output: 'Error: Compilation service temporarily unavailable\n'
                });
            }
        });

        const timeout = setTimeout(() => {
            if (dockerProcess) {
                dockerProcess.kill();
                const socket = io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.emit('program-output', {
                        output: '\n***********Process Terminated: Time Limit Exceeded (1 minute)***********\n'
                    });
                }
            }
        }, 60000);

        res.json({ status: 'started', socketId });

        dockerProcess.stdout.on('data', (data) => {
            console.log('Program output:', data.toString());
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('program-output', {
                    output: data.toString()
                });
            }
        });

        dockerProcess.stderr.on('data', (data) => {
            console.log('Program error:', data.toString());
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('program-output', {
                    output: data.toString()
                });
            }
        });

        dockerProcess.on('exit', (code) => {
            clearTimeout(timeout);
            console.log(`Docker process exited with code ${code}`);
            const socket = io.sockets.sockets.get(socketId);
            if (socket) {
                socket.emit('program-output', {
                    output: '\n***********Execution Complete***********\n'
                });
            }
            
            filesToCleanup.forEach(file => {
                try {
                    const fileToDelete = path.join(uniqueTempDir, file);
                    if (fs.existsSync(fileToDelete)) {
                        fs.unlinkSync(fileToDelete);
                        console.log(`Cleaned up file: ${fileToDelete}`);
                    }
                } catch (err) {
                    console.error(`Error cleaning up file ${file}:`, err);
                }
            });

            fs.rmSync(uniqueTempDir, { recursive: true, force: true });
        });

        const socket = io.sockets.sockets.get(socketId);
        if (socket) {
            socket.dockerProcess = dockerProcess;
        } else {
            dockerProcess.kill();
        }
        
    } catch (error) {
        console.error('Compilation error:', error);
        res.status(500).json({ error: 'Internal server error during compilation' });
    }
});

server.listen(PORT, HOST, () => {
    console.log(`Server is running at http://${HOST}:${PORT}`);
});
