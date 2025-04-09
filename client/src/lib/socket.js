import { io } from "socket.io-client";

export const initSocket = async() => {
    const option = {
        "force new connection": true,
        reconnectionAttempts: "infinity",
        timeout: 10000,
        transports: ['websocket'],
        withCredentials: true
    }
    return io(import.meta.env.VITE_SOCKET_URL, option);
}
