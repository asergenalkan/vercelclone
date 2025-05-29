import { io, Socket } from "socket.io-client";

let workerSocket: Socket | null = null;
let isConnected = false;
const pendingLogs: Array<{ deploymentId: string; log: string; status?: string }> = [];
const pendingStatuses: Array<{ deploymentId: string; status: string }> = [];

export function initWorkerSocket() {
  const SOCKET_URL = process.env.SOCKET_URL || "http://localhost:3003";
  
  workerSocket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  workerSocket.on("connect", () => {
    console.log(`✅ Worker socket server'a bağlandı: ${SOCKET_URL}`);
    isConnected = true;
    
    // Bekleyen logları gönder
    while (pendingLogs.length > 0) {
      const logData = pendingLogs.shift();
      if (logData && workerSocket) {
        workerSocket.emit("worker:build-log", {
          deploymentId: logData.deploymentId,
          log: logData.log,
          status: logData.status,
          timestamp: new Date().toISOString(),
        });
      }
    }
    
    // Bekleyen status güncellemelerini gönder
    while (pendingStatuses.length > 0) {
      const statusData = pendingStatuses.shift();
      if (statusData && workerSocket) {
        workerSocket.emit("worker:deployment-status", {
          deploymentId: statusData.deploymentId,
          status: statusData.status,
          timestamp: new Date().toISOString(),
        });
      }
    }
  });

  workerSocket.on("disconnect", () => {
    console.log("❌ Worker socket server bağlantısı kesildi");
    isConnected = false;
  });

  workerSocket.on("error", (error) => {
    console.error("Socket bağlantı hatası:", error);
  });

  return workerSocket;
}

export function emitBuildLogFromWorker(deploymentId: string, log: string, status?: string) {
  if (workerSocket && isConnected) {
    // Bağlantı varsa direkt gönder
    workerSocket.emit("worker:build-log", {
      deploymentId,
      log,
      status,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Bağlantı yoksa kuyruğa ekle
    pendingLogs.push({ deploymentId, log, status });
    
    // İlk kez log geliyorsa socket'i başlat
    if (!workerSocket) {
      initWorkerSocket();
    }
  }
}

export function emitDeploymentStatusFromWorker(deploymentId: string, status: string) {
  if (workerSocket && isConnected) {
    // Bağlantı varsa direkt gönder
    workerSocket.emit("worker:deployment-status", {
      deploymentId,
      status,
      timestamp: new Date().toISOString(),
    });
  } else {
    // Bağlantı yoksa kuyruğa ekle
    pendingStatuses.push({ deploymentId, status });
    
    // İlk kez status geliyorsa socket'i başlat
    if (!workerSocket) {
      initWorkerSocket();
    }
  }
}

export function disconnectWorkerSocket() {
  if (workerSocket) {
    workerSocket.disconnect();
    workerSocket = null;
    isConnected = false;
  }
} 