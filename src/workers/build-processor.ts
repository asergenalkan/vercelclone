import { buildQueue } from "@/lib/queue/build-queue";
import { BuildWorker } from "@/lib/build/build-worker";

// Build worker instance
const buildWorker = new BuildWorker();

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
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("SIGINT sinyali alındı, worker kapatılıyor...");
  await buildQueue.close();
  process.exit(0);
});

console.log("Build worker başlatıldı ve job'ları bekliyor..."); 