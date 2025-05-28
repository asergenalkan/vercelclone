import { Server as HTTPServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { buildQueue } from "../queue/build-queue";
import { db } from "../db";

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [
        "http://localhost:3000", 
        "http://localhost:3001",
        process.env.NEXTAUTH_URL || "http://localhost:3000"
      ],
      methods: ["GET", "POST"],
      credentials: true,
    },
    path: "/socket.io/",
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);

    // Deployment log subscription
    socket.on("subscribe:deployment", async (deploymentId: string) => {
      console.log(`Client ${socket.id} subscribed to deployment ${deploymentId}`);
      
      // Deployment'ın varlığını kontrol et
      const deployment = await db.deployment.findUnique({
        where: { id: deploymentId },
        select: { id: true, status: true, buildLogs: true },
      });

      if (!deployment) {
        socket.emit("error", { message: "Deployment bulunamadı" });
        return;
      }

      // Room'a katıl
      socket.join(`deployment:${deploymentId}`);

      // Mevcut logları gönder
      socket.emit("deployment:logs", {
        deploymentId,
        logs: deployment.buildLogs || "",
        status: deployment.status,
      });
    });

    // Unsubscribe
    socket.on("unsubscribe:deployment", (deploymentId: string) => {
      console.log(`Client ${socket.id} unsubscribed from deployment ${deploymentId}`);
      socket.leave(`deployment:${deploymentId}`);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Build queue event listeners for real-time updates
  setupBuildQueueListeners();

  return io;
}

export function getSocketServer(): SocketIOServer | null {
  return io;
}

// Build log gönderme helper'ı
export function emitBuildLog(deploymentId: string, log: string, status?: string) {
  if (!io) return;

  io.to(`deployment:${deploymentId}`).emit("deployment:log", {
    deploymentId,
    log,
    status,
    timestamp: new Date().toISOString(),
  });
}

// Deployment status update helper'ı
export function emitDeploymentStatus(deploymentId: string, status: string) {
  if (!io) return;

  io.to(`deployment:${deploymentId}`).emit("deployment:status", {
    deploymentId,
    status,
    timestamp: new Date().toISOString(),
  });
}

// Build queue event listeners
function setupBuildQueueListeners() {
  buildQueue.on("active", async (job) => {
    const { deploymentId } = job.data;
    emitBuildLog(deploymentId, "Build işlemi başladı...\n");
    emitDeploymentStatus(deploymentId, "BUILDING");
  });

  buildQueue.on("progress", async (job, progress) => {
    const { deploymentId } = job.data;
    emitBuildLog(deploymentId, `İlerleme: ${progress}%\n`);
  });

  buildQueue.on("completed", async (job) => {
    const { deploymentId } = job.data;
    emitBuildLog(deploymentId, "Build işlemi başarıyla tamamlandı!\n");
    emitDeploymentStatus(deploymentId, "READY");
  });

  buildQueue.on("failed", async (job, err) => {
    const { deploymentId } = job.data;
    emitBuildLog(deploymentId, `Build hatası: ${err.message}\n`);
    emitDeploymentStatus(deploymentId, "FAILED");
  });
} 