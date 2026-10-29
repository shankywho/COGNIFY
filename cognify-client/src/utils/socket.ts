import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getWorkflowSocket(): Socket {
  if (!socket) {
    const rawUrl = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const serverUrl = rawUrl.replace(/\/api\/?$/, "");
    const token = localStorage.getItem("token");

    socket = io(serverUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
  }
  return socket;
}
