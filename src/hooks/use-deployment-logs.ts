"use client";

import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";

interface DeploymentLog {
  deploymentId: string;
  log: string;
  status?: string;
  timestamp: string;
}

interface DeploymentStatus {
  deploymentId: string;
  status: string;
  timestamp: string;
}

export function useDeploymentLogs(deploymentId: string | null) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [status, setStatus] = useState<string>("PENDING");
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!deploymentId) return;

    // Socket bağlantısı kur
    const socketInstance = io("http://localhost:3003", {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
    });

    socketInstance.on("connect", () => {
      console.log("Socket connected");
      setIsConnected(true);
      
      // Deployment'a subscribe ol
      socketInstance.emit("subscribe:deployment", deploymentId);
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket disconnected");
      setIsConnected(false);
    });

    // İlk log batch'i
    socketInstance.on("deployment:logs", (data: { logs: string; status: string }) => {
      setLogs(data.logs);
      setStatus(data.status);
    });

    // Real-time log updates
    socketInstance.on("deployment:log", (data: DeploymentLog) => {
      setLogs((prevLogs) => prevLogs + data.log);
    });

    // Status updates
    socketInstance.on("deployment:status", (data: DeploymentStatus) => {
      setStatus(data.status);
    });

    // Error handling
    socketInstance.on("error", (error: { message: string }) => {
      console.error("Socket error:", error);
    });

    setSocket(socketInstance);

    // Cleanup
    return () => {
      if (socketInstance.connected) {
        socketInstance.emit("unsubscribe:deployment", deploymentId);
        socketInstance.disconnect();
      }
    };
  }, [deploymentId]);

  const clearLogs = useCallback(() => {
    setLogs("");
  }, []);

  return {
    logs,
    status,
    isConnected,
    clearLogs,
  };
} 