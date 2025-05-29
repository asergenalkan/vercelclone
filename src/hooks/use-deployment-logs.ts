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

    // Protokol ve domain adresini al (http://localhost:3000 veya https://pixepix.com)
    const getSocketUrl = () => {
      if (typeof window === 'undefined') return '';
      
      // Sunucu ortamına göre socket URL'i ayarla
      const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
      const host = window.location.hostname;
      
      // Socket.io sunucusu port 3003'te çalışıyor, ancak nginx proxy ile ana domaine map edilmiş
      return `${protocol}//${host}`;
    };

    const socketUrl = getSocketUrl();
    console.log(`📡 Socket bağlantısı kuruluyor: ${socketUrl}, deploymentId: ${deploymentId}`);

    // Socket bağlantısı kur
    const socketInstance = io(socketUrl, {
      path: "/socket.io/",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 30000,
      forceNew: true,
    });

    socketInstance.on("connect_error", (err) => {
      console.error("Socket bağlantı hatası:", err.message);
      setIsConnected(false);
    });

    socketInstance.on("connect_timeout", () => {
      console.error("Socket bağlantı zaman aşımı");
      setIsConnected(false);
    });

    socketInstance.on("reconnect_attempt", (attempt) => {
      console.log(`Yeniden bağlanma denemesi: ${attempt}`);
    });

    socketInstance.on("connect", () => {
      console.log("Socket bağlandı:", socketInstance.id);
      setIsConnected(true);
      
      // Deployment'a subscribe ol
      console.log(`Deployment'a abone olunuyor: ${deploymentId}`);
      socketInstance.emit("subscribe:deployment", deploymentId);
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket bağlantısı kesildi");
      setIsConnected(false);
    });

    // İlk log batch'i
    socketInstance.on("deployment:logs", (data: { logs: string; status: string }) => {
      console.log(`İlk loglar alındı, durum: ${data.status}`);
      setLogs(data.logs || "");
      setStatus(data.status);
    });

    // Real-time log updates
    socketInstance.on("deployment:log", (data: DeploymentLog) => {
      console.log(`Log güncellendi, deployment: ${data.deploymentId}`);
      setLogs((prevLogs) => prevLogs + data.log);
      if (data.status) {
        setStatus(data.status);
      }
    });

    // Status updates
    socketInstance.on("deployment:status", (data: DeploymentStatus) => {
      console.log(`Durum güncellendi: ${data.status}`);
      setStatus(data.status);
    });

    // Error handling
    socketInstance.on("error", (error: { message: string }) => {
      console.error("Socket hatası:", error);
    });

    setSocket(socketInstance);

    // Cleanup
    return () => {
      console.log(`Socket bağlantısı kapatılıyor, deployment: ${deploymentId}`);
      if (socketInstance.connected) {
        socketInstance.emit("unsubscribe:deployment", deploymentId);
        socketInstance.disconnect();
      }
      setSocket(null);
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