import { buildQueue } from "@/lib/queue/build-queue";
import { BuildWorker } from "@/lib/build/build-worker";
import { disconnectWorkerSocket } from "@/lib/socket/socket-client";
import fs from 'fs';
import path from 'path';

// Build worker instance
const buildWorker = new BuildWorker();

// Enhanced logging setup
const logDirectory = path.join(process.cwd(), "logs");
const workerId = process.env.pm_id || Date.now().toString(); // PM2 instance ID'sini al, yoksa timestamp kullan
const logFilePath = path.join(logDirectory, `worker-${workerId}.log`);

// Log dizinini oluştur
try {
  if (!fs.existsSync(logDirectory)) {
    fs.mkdirSync(logDirectory, { recursive: true });
  }
} catch (error) {
  console.error("Log dizini oluşturulamadı:", error);
}

// Log fonksiyonunu gölgele
const originalConsoleLog = console.log;
const originalConsoleError = console.error;

// Konsol çıktısını hem klasik konsola hem de dosyaya yazan bir fonksiyon
console.log = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  // Orijinal konsol fonksiyonunu çağır
  originalConsoleLog.apply(console, args);
  
  // Dosyaya yaz
  try {
    fs.appendFileSync(logFilePath, `${new Date().toISOString()} [INFO] ${message}\n`);
  } catch (err) {
    originalConsoleError.apply(console, [`Loga yazma hatası: ${err}`]);
  }
};

console.error = function(...args) {
  const message = args.map(arg => 
    typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(' ');
  
  // Orijinal konsol fonksiyonunu çağır
  originalConsoleError.apply(console, args);
  
  // Dosyaya yaz
  try {
    fs.appendFileSync(logFilePath, `${new Date().toISOString()} [ERROR] ${message}\n`);
  } catch (err) {
    originalConsoleError.apply(console, [`Loga yazma hatası: ${err}`]);
  }
};

// Başlangıç mesajı
console.log(`Build worker başlatıldı. Worker ID: ${workerId}, Log dosyası: ${logFilePath}`);

// Job processor
buildQueue.process("build", async (job) => {
  console.log(`Build job başlatıldı: ${job.id} - Deployment: ${job.data.deploymentId}`);
  console.log(`Job data:`, JSON.stringify(job.data, null, 2));
  
  try {
    const result = await buildWorker.processBuildJob(job);
    console.log(`Build job tamamlandı: ${job.id}`, result);
    return result;
  } catch (error) {
    console.error(`Build job başarısız: ${job.id}`, error);
    console.error(`Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    throw error;
  }
});

// Error handling
buildQueue.on('error', (error) => {
  console.error('Build queue hatası:', error);
});

buildQueue.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed for deployment ${job.data.deploymentId}:`, err);
});

buildQueue.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed for deployment ${job.data.deploymentId}`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("SIGTERM sinyali alındı, worker kapatılıyor...");
  await buildQueue.close();
  disconnectWorkerSocket();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT sinyali alındı, worker kapatılıyor...");
  await buildQueue.close();
  disconnectWorkerSocket();
  process.exit(0);
});

console.log("Build worker başlatıldı ve job'ları bekliyor..."); 