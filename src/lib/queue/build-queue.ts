import Bull from "bull";
import Redis from "ioredis";

// Redis bağlantısı
const redisConfig = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379"),
  password: process.env.REDIS_PASSWORD,
};

// Build Queue
export const buildQueue = new Bull("build-queue", {
  redis: redisConfig,
  defaultJobOptions: {
    removeOnComplete: 100, // Tamamlanan son 100 job'ı tut
    removeOnFail: 50, // Başarısız olan son 50 job'ı tut
    attempts: 1, // Sadece 1 deneme (retry yok)
    backoff: {
      type: "exponential",
      delay: 2000,
    },
  },
});

// Job tipleri
export interface BuildJobData {
  deploymentId: string;
  projectId: string;
  userId: string;
  repoUrl: string;
  branch: string;
  commit: string;
  framework: string;
  buildCommand?: string;
  installCommand?: string;
  outputDirectory?: string;
  nodeVersion?: string;
  envVariables?: Record<string, string>;
  githubAccessToken?: string; // User'ın GitHub access token'ı
}

// Queue event listeners
buildQueue.on("completed", (job, result) => {
  console.log(`Build job ${job.id} completed for deployment ${job.data.deploymentId}`);
});

buildQueue.on("failed", (job, err) => {
  console.error(`Build job ${job.id} failed for deployment ${job.data.deploymentId}:`, err);
});

buildQueue.on("stalled", (job) => {
  console.warn(`Build job ${job.id} stalled for deployment ${job.data.deploymentId}`);
});

// Helper functions
export async function addBuildJob(data: BuildJobData) {
  const job = await buildQueue.add("build", data, {
    priority: data.branch === "main" || data.branch === "master" ? 1 : 2,
  });
  
  return job;
}

export async function getBuildJob(jobId: string) {
  const job = await buildQueue.getJob(jobId);
  return job;
}

export async function getBuildJobStatus(jobId: string) {
  const job = await buildQueue.getJob(jobId);
  if (!job) return null;
  
  const state = await job.getState();
  const progress = job.progress();
  
  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    failedReason: job.failedReason,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

export async function cancelBuildJob(jobId: string) {
  const job = await buildQueue.getJob(jobId);
  if (job) {
    await job.remove();
    return true;
  }
  return false;
} 