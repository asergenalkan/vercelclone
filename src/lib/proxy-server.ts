import { createProxyServer, loadExistingContainers } from "./deployment-service";

async function startProxyServer() {
  console.log("Proxy server başlatılıyor...");
  
  // Mevcut container'ları yükle
  await loadExistingContainers();
  
  // Proxy server'ı başlat
  const server = createProxyServer();
  
  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("SIGTERM sinyali alındı, server kapatılıyor...");
    server.close(() => {
      console.log("Proxy server kapatıldı");
      process.exit(0);
    });
  });

  process.on("SIGINT", () => {
    console.log("SIGINT sinyali alındı, server kapatılıyor...");
    server.close(() => {
      console.log("Proxy server kapatıldı");
      process.exit(0);
    });
  });
}

// Server'ı başlat
startProxyServer().catch((error) => {
  console.error("Proxy server başlatma hatası:", error);
  process.exit(1);
}); 