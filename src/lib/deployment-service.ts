import Docker from "dockerode";
import { db } from "./db";
import httpProxy from "http-proxy-middleware";
import { Server } from "http";
import express from "express";

const docker = new Docker();

// Deployment'ları port'lara map'leyen cache
const deploymentPorts = new Map<string, number>();
const deploymentContainers = new Map<string, string>();

// Boş port bulma
let currentPort = 4000;
async function getNextPort(): Promise<number> {
  // Kullanılan portları kontrol et
  const usedPorts = new Set(Array.from(deploymentPorts.values()));
  
  // Docker'dan çalışan container'ların portlarını al
  try {
    const containers = await docker.listContainers();
    for (const container of containers) {
      if (container.Ports) {
        for (const port of container.Ports) {
          if (port.PublicPort) {
            usedPorts.add(port.PublicPort);
          }
        }
      }
    }
  } catch (error) {
    console.error("Port kontrolü hatası:", error);
  }
  
  // Boş port bul
  while (usedPorts.has(currentPort)) {
    currentPort++;
  }
  
  const port = currentPort;
  currentPort++;
  return port;
}

export async function startDeploymentContainer(deploymentId: string, imageName: string): Promise<string> {
  try {
    // Deployment bilgilerini al
    const deployment = await db.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: true }
    });

    if (!deployment) {
      throw new Error("Deployment bulunamadı");
    }

    // Aynı proje için eski deployment'ları durdur
    await stopOldDeployments(deployment.projectId, deploymentId);

    // Image'ın var olup olmadığını kontrol et
    try {
      await docker.getImage(imageName).inspect();
      console.log(`Docker image bulundu: ${imageName}`);
    } catch (imageError) {
      console.error(`Docker image bulunamadı: ${imageName}`, imageError);
      throw new Error(`Docker image bulunamadı: ${imageName}. Build işlemi tamamlanmamış olabilir.`);
    }

    // Port tahsis et
    const port = await getNextPort();
    
    // Container oluştur ve başlat
    const container = await docker.createContainer({
      Image: imageName,
      name: `deployment-${deploymentId}`,
      ExposedPorts: {
        "3000/tcp": {} // Next.js default port
      },
      HostConfig: {
        PortBindings: {
          "3000/tcp": [{ HostPort: port.toString() }]
        },
        RestartPolicy: {
          Name: "unless-stopped"
        }
      },
      Env: [
        `NODE_ENV=production`,
        // Environment variables ekle
        ...(await getEnvVariables(deployment.projectId, deployment.isPreview ? "preview" : "production"))
      ]
    });

    await container.start();

    // Container ID ve port'u kaydet
    deploymentPorts.set(deploymentId, port);
    deploymentContainers.set(deploymentId, container.id);

    // URL oluştur
    const url = deployment.isPreview 
      ? `https://${deployment.id}.preview.vercelclone.com`
      : `https://${deployment.project.name}.vercelclone.com`;

    // Deployment'ı güncelle
    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        url,
        status: "READY",
        containerId: container.id,
        port
      }
    });

    console.log(`Container başlatıldı: ${deploymentId} -> Port ${port}`);
    
    // Eski image'ları temizle (async olarak)
    cleanupOldImages(deployment.projectId).catch(console.error);
    
    return url;

  } catch (error) {
    console.error("Container başlatma hatası:", error);
    throw error;
  }
}

export async function stopDeploymentContainer(deploymentId: string): Promise<void> {
  try {
    const containerId = deploymentContainers.get(deploymentId);
    
    if (containerId) {
      const container = docker.getContainer(containerId);
      await container.stop();
      await container.remove();
      
      deploymentPorts.delete(deploymentId);
      deploymentContainers.delete(deploymentId);
      
      console.log(`Container durduruldu: ${deploymentId}`);
    }
  } catch (error) {
    console.error("Container durdurma hatası:", error);
  }
}

// Aynı proje için eski deployment'ları durdur
async function stopOldDeployments(projectId: string, currentDeploymentId: string): Promise<void> {
  try {
    // Aynı projenin eski READY deployment'larını bul
    const oldDeployments = await db.deployment.findMany({
      where: {
        projectId,
        status: "READY",
        id: { not: currentDeploymentId },
        containerId: { not: null }
      }
    });

    console.log(`${oldDeployments.length} eski deployment durduruluyor...`);

    for (const deployment of oldDeployments) {
      if (deployment.containerId) {
        try {
          // Container'ın gerçekten var olup olmadığını kontrol et
          const container = docker.getContainer(deployment.containerId);
          const containerInfo = await container.inspect();
          
          if (containerInfo.State.Running) {
            console.log(`Container durduruluyor: ${deployment.id}`);
            await container.stop({ t: 10 }); // 10 saniye timeout
          }
          
          // Container'ı sil
          await container.remove({ force: true });
          
          // Cache'den temizle
          deploymentPorts.delete(deployment.id);
          deploymentContainers.delete(deployment.id);
          
          // Database'de güncelle
          await db.deployment.update({
            where: { id: deployment.id },
            data: {
              status: "STOPPED",
              containerId: null,
              port: null
            }
          });
          
          console.log(`Eski container durduruldu: ${deployment.id}`);
        } catch (error) {
          console.error(`Container durdurulamadı: ${deployment.id}`, error);
          
          // Container bulunamadıysa database'i temizle
          if ((error as any).statusCode === 404) {
            deploymentPorts.delete(deployment.id);
            deploymentContainers.delete(deployment.id);
            
            await db.deployment.update({
              where: { id: deployment.id },
              data: {
                status: "STOPPED",
                containerId: null,
                port: null
              }
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Eski deployment'ları durdurma hatası:", error);
  }
}

// Eski image'ları temizle
async function cleanupOldImages(projectId: string): Promise<void> {
  try {
    // Aynı projenin eski deployment'larını bul (son 3 hariç)
    const oldDeployments = await db.deployment.findMany({
      where: {
        projectId,
        status: { in: ["STOPPED", "FAILED"] }
      },
      orderBy: {
        createdAt: "desc"
      },
      skip: 3 // Son 3'ü koru
    });

    console.log(`${oldDeployments.length} eski image temizleniyor...`);

    for (const deployment of oldDeployments) {
      try {
        const imageName = `vercel-clone/${deployment.id}:latest`;
        const image = docker.getImage(imageName);
        
        // Image'ı sil
        await image.remove({ force: true });
        console.log(`Eski image silindi: ${imageName}`);
      } catch (error) {
        // Image zaten silinmiş olabilir, hata vermesin
        console.log(`Image silinemedi (muhtemelen zaten yok): vercel-clone/${deployment.id}:latest`);
      }
    }

    // Dangling image'ları da temizle
    try {
      const images = await docker.listImages({
        filters: { dangling: ["true"] }
      });
      
      for (const imageInfo of images) {
        try {
          const image = docker.getImage(imageInfo.Id);
          await image.remove({ force: true });
          console.log(`Dangling image silindi: ${imageInfo.Id}`);
        } catch (error) {
          console.log(`Dangling image silinemedi: ${imageInfo.Id}`);
        }
      }
    } catch (error) {
      console.error("Dangling image'ları temizleme hatası:", error);
    }
  } catch (error) {
    console.error("Eski image'ları temizleme hatası:", error);
  }
}

// Environment variables'ları getir
async function getEnvVariables(projectId: string, target: string): Promise<string[]> {
  const envVars = await db.envVariable.findMany({
    where: {
      projectId,
      target: {
        has: target
      }
    }
  });

  return envVars.map(env => {
    // Decrypt işlemi burada yapılmalı
    const decryptedValue = decrypt(env.value);
    return `${env.key}=${decryptedValue}`;
  });
}

// Basit decrypt fonksiyonu (auth.ts'den import edilmeli)
function decrypt(text: string): string {
  const crypto = require("crypto");
  const ENCRYPTION_KEY = process.env.ENV_ENCRYPTION_KEY || "default-encryption-key-change-this";
  const decipher = crypto.createDecipher("aes-256-cbc", ENCRYPTION_KEY);
  let decrypted = decipher.update(text, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Proxy server oluştur
export function createProxyServer(): Server {
  const app = express();

  // Health check
  app.get("/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Wildcard subdomain routing
  app.use(async (req, res, next) => {
    const host = req.hostname;
    
    // Preview deployment check
    const previewMatch = host.match(/^([a-z0-9]+)\.preview\.vercelclone\.com$/);
    if (previewMatch) {
      const deploymentId = previewMatch[1];
      const port = deploymentPorts.get(deploymentId);
      
      if (port) {
        return httpProxy.createProxyMiddleware({
          target: `http://localhost:${port}`,
          changeOrigin: true,
          ws: true
        })(req, res, next);
      }
    }

    // Production deployment check
    const deployment = await db.deployment.findFirst({
      where: {
        url: `https://${host}`,
        status: "READY"
      },
      orderBy: {
        createdAt: "desc"
      }
    });

    if (deployment && deployment.port) {
      return httpProxy.createProxyMiddleware({
        target: `http://localhost:${deployment.port}`,
        changeOrigin: true,
        ws: true
      })(req, res, next);
    }

    // 404 if no deployment found
    res.status(404).send("Deployment not found");
  });

  const server = app.listen(80, () => {
    console.log("Proxy server listening on port 80");
  });

  return server;
}

// Startup: Mevcut container'ları yükle
export async function loadExistingContainers() {
  try {
    const deployments = await db.deployment.findMany({
      where: {
        status: "READY",
        containerId: { not: null }
      }
    });

    for (const deployment of deployments) {
      if (deployment.containerId && deployment.port) {
        deploymentPorts.set(deployment.id, deployment.port);
        deploymentContainers.set(deployment.id, deployment.containerId);
      }
    }

    console.log(`${deployments.length} mevcut deployment yüklendi`);
  } catch (error) {
    console.error("Mevcut container'ları yükleme hatası:", error);
  }
} 