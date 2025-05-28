import { Job } from "bull";
import { BuildJobData } from "../queue/build-queue";
import { db } from "@/lib/db";
import Docker from "dockerode";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { emitBuildLog } from "../socket/socket-server";
import { startDeploymentContainer } from "../deployment-service";
import { createDeploymentComment } from "../github/pr-comments";

const execAsync = promisify(exec);
const docker = new Docker();

export class BuildWorker {
  private buildsDir: string;
  private currentJobData?: BuildJobData;

  constructor() {
    this.buildsDir = process.env.BUILDS_DIR || path.join(process.cwd(), "builds");
    this.ensureBuildsDir();
  }

  private async ensureBuildsDir() {
    try {
      await fs.mkdir(this.buildsDir, { recursive: true });
    } catch (error) {
      console.error("Build dizini oluşturulamadı:", error);
    }
  }

  async processBuildJob(job: Job<BuildJobData>) {
    const { deploymentId, projectId, repoUrl, branch, commit, framework } = job.data;
    
    // Job data'yı class property'ye ata (cloneRepository'de kullanmak için)
    this.currentJobData = job.data;
    
    try {
      console.log(`🚀 Build işlemi başlatılıyor - Deployment: ${deploymentId}`);
      console.log(`📋 Build parametreleri:`, {
        deploymentId,
        projectId,
        repoUrl,
        branch,
        framework,
        hasUserToken: !!job.data.githubAccessToken
      });

      // Deployment durumunu güncelle
      await this.updateDeploymentStatus(deploymentId, "BUILDING", "Build başlatılıyor...");
      await job.progress(10);

      // Deployment bilgilerini al
      const deployment = await db.deployment.findUnique({
        where: { id: deploymentId }
      });

      console.log(`📄 Deployment bilgileri alındı:`, deployment?.id);

      // PR comment güncelle (eğer preview deployment ise)
      if (deployment?.isPreview) {
        console.log(`💬 PR comment güncelleniyor...`);
        await createDeploymentComment(deploymentId, "building");
      }

      // Proje dizini oluştur
      const projectDir = path.join(this.buildsDir, deploymentId);
      console.log(`📁 Proje dizini oluşturuluyor: ${projectDir}`);
      await fs.mkdir(projectDir, { recursive: true });

      // Repository'yi klonla
      console.log(`📥 Repository klonlanıyor: ${repoUrl}`);
      await this.updateDeploymentStatus(deploymentId, "BUILDING", "Repository klonlanıyor...");
      await this.cloneRepository(repoUrl, branch, projectDir, deploymentId);
      await job.progress(30);

      // Bağımlılıkları yükle
      console.log(`📦 Bağımlılıklar yükleniyor...`);
      await this.updateDeploymentStatus(deploymentId, "BUILDING", "Bağımlılıklar yükleniyor...");
      await this.installDependencies(projectDir, job.data.installCommand, deploymentId);
      await job.progress(50);

      // Build işlemi
      console.log(`🔨 Proje build ediliyor...`);
      await this.updateDeploymentStatus(deploymentId, "BUILDING", "Proje build ediliyor...");
      await this.buildProject(projectDir, framework, job.data.buildCommand, deploymentId);
      await job.progress(70);

      // Docker image oluştur
      console.log(`🐳 Docker image oluşturuluyor...`);
      await this.updateDeploymentStatus(deploymentId, "BUILDING", "Container oluşturuluyor...");
      const imageName = await this.createDockerImage(deploymentId, projectDir, framework, job.data);
      await job.progress(90);

      console.log(`✅ Docker image oluşturuldu: ${imageName}`);

      // Container'ı başlat ve deploy et
      console.log(`🚀 Container başlatılıyor...`);
      await this.updateDeploymentStatus(deploymentId, "BUILDING", "Container başlatılıyor...");
      const url = await startDeploymentContainer(deploymentId, imageName);
      await job.progress(95);

      // Deployment'ı tamamla
      console.log(`🎉 Deployment tamamlandı: ${url}`);
      await this.updateDeploymentStatus(deploymentId, "READY", "Deployment hazır!");
      
      // PR comment güncelle (eğer preview deployment ise)
      if (deployment?.isPreview) {
        await createDeploymentComment(deploymentId, "ready");
      }
      
      await job.progress(100);

      // Temizlik
      console.log(`🧹 Temizlik yapılıyor...`);
      await this.cleanup(projectDir);

      return {
        success: true,
        deploymentId,
        imageName,
        url,
      };
    } catch (error) {
      console.error(`❌ Build hatası (${deploymentId}):`, error);
      await this.updateDeploymentStatus(
        deploymentId, 
        "FAILED", 
        `Build hatası: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`
      );
      
      // PR comment güncelle (eğer preview deployment ise)
      const deployment = await db.deployment.findUnique({
        where: { id: deploymentId }
      });
      
      if (deployment?.isPreview) {
        await createDeploymentComment(deploymentId, "failed");
      }
      
      throw error;
    }
  }

  private async cloneRepository(repoUrl: string, branch: string, targetDir: string, deploymentId: string) {
    // User'ın GitHub token'ını job data'dan al
    const jobData = this.currentJobData; // Job data'yı class property olarak saklamalıyız
    const githubToken = jobData?.githubAccessToken || process.env.GITHUB_TOKEN || process.env.GITHUB_SECRET;
    
    let cloneUrl = repoUrl;
    
    // GitHub repo ise token ekle
    if (repoUrl.includes('github.com') && githubToken) {
      // https://github.com/user/repo.git -> https://token@github.com/user/repo.git
      cloneUrl = repoUrl.replace('https://github.com/', `https://${githubToken}@github.com/`);
    }
    
    const command = `git clone --depth 1 --branch ${branch} "${cloneUrl}" .`;
    
    return new Promise<void>((resolve, reject) => {
      const childProcess = exec(command, { cwd: targetDir });
      
      childProcess.stdout?.on('data', (data) => {
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.stderr?.on('data', (data) => {
        // Token'ı loglardan gizle
        const sanitizedData = data.toString().replace(new RegExp(githubToken || '', 'g'), '***');
        emitBuildLog(deploymentId, sanitizedData);
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          emitBuildLog(deploymentId, "Repository başarıyla klonlandı.\n");
          resolve();
        } else {
          emitBuildLog(deploymentId, `Git clone başarısız (code ${code}). Demo deployment oluşturuluyor...\n`);
          // Demo deployment oluştur
          this.createDemoProject(targetDir, deploymentId).then(resolve).catch(reject);
        }
      });
    });
  }

  private async createDemoProject(targetDir: string, deploymentId: string): Promise<void> {
    try {
      emitBuildLog(deploymentId, "Demo Next.js projesi oluşturuluyor...\n");
      
      // package.json oluştur
      const packageJson = {
        name: `demo-deployment-${deploymentId}`,
        version: "1.0.0",
        scripts: {
          dev: "next dev",
          build: "next build",
          start: "next start"
        },
        dependencies: {
          next: "^14.0.0",
          react: "^18.0.0",
          "react-dom": "^18.0.0"
        },
        devDependencies: {
          "@types/node": "^20.0.0",
          "@types/react": "^18.0.0",
          "@types/react-dom": "^18.0.0",
          typescript: "^5.0.0"
        }
      };
      
      await fs.writeFile(
        path.join(targetDir, "package.json"), 
        JSON.stringify(packageJson, null, 2)
      );
      
      // pages/index.js oluştur
      const pagesDir = path.join(targetDir, "pages");
      await fs.mkdir(pagesDir, { recursive: true });
      
      const indexPage = `
export default function Home() {
  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'system-ui, sans-serif',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
        🚀 Demo Deployment
      </h1>
      <p style={{ fontSize: '1.2rem', marginBottom: '2rem', opacity: 0.9 }}>
        Bu bir demo deployment'tır. Gerçek projeniz için GitHub repository bağlayın.
      </p>
      <div style={{ 
        background: 'rgba(255,255,255,0.1)', 
        padding: '1rem', 
        borderRadius: '8px',
        backdropFilter: 'blur(10px)'
      }}>
        <p style={{ margin: 0, fontSize: '0.9rem' }}>
          Deployment ID: ${deploymentId}
        </p>
        <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
          Powered by Vercel Clone
        </p>
      </div>
    </div>
  );
}
`;
      
      await fs.writeFile(path.join(pagesDir, "index.js"), indexPage);
      
      // public klasörü oluştur
      const publicDir = path.join(targetDir, "public");
      await fs.mkdir(publicDir, { recursive: true });
      
      // favicon.ico oluştur (basit SVG)
      const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="40" fill="#667eea"/>
  <text x="50" y="60" text-anchor="middle" fill="white" font-size="40" font-family="Arial">🚀</text>
</svg>`;
      
      await fs.writeFile(path.join(publicDir, "favicon.ico"), favicon);
      
      // robots.txt oluştur
      const robotsTxt = `User-agent: *
Allow: /

Sitemap: https://demo.vercel-clone.app/sitemap.xml`;
      
      await fs.writeFile(path.join(publicDir, "robots.txt"), robotsTxt);
      
      // next.config.js oluştur
      const nextConfig = `
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    outputFileTracingRoot: undefined,
  },
}

module.exports = nextConfig
`;
      
      await fs.writeFile(path.join(targetDir, "next.config.js"), nextConfig);
      
      emitBuildLog(deploymentId, "Demo proje başarıyla oluşturuldu.\n");
      
    } catch (error) {
      emitBuildLog(deploymentId, `Demo proje oluşturma hatası: ${error}\n`);
      throw error;
    }
  }

  private async installDependencies(projectDir: string, customCommand: string | undefined, deploymentId: string) {
    const command = customCommand || "npm install";
    
    return new Promise<string>((resolve, reject) => {
      const childProcess = exec(command, { cwd: projectDir });
      let output = '';
      
      childProcess.stdout?.on('data', (data) => {
        output += data;
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.stderr?.on('data', (data) => {
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          emitBuildLog(deploymentId, "Bağımlılıklar başarıyla yüklendi.\n");
          resolve(output);
        } else {
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  private async buildProject(projectDir: string, framework: string, customCommand: string | undefined, deploymentId: string) {
    // Next.js için standalone output'u etkinleştir
    if (framework === "next") {
      await this.ensureNextStandaloneOutput(projectDir, deploymentId);
    }
    
    let buildCommand = customCommand;
    
    if (!buildCommand) {
      // Framework'e göre varsayılan build komutları
      switch (framework) {
        case "next":
          buildCommand = "npm run build";
          break;
        case "react":
          buildCommand = "npm run build";
          break;
        case "vue":
          buildCommand = "npm run build";
          break;
        default:
          buildCommand = "npm run build";
      }
    }
    
    emitBuildLog(deploymentId, `Executing build command: ${buildCommand}\n`);
    
    return new Promise<string>((resolve, reject) => {
      const childProcess = exec(buildCommand, { cwd: projectDir });
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout?.on('data', (data) => {
        output += data;
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.stderr?.on('data', (data) => {
        errorOutput += data;
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          emitBuildLog(deploymentId, "Build işlemi başarıyla tamamlandı.\n");
          resolve(output);
        } else {
          const errorMessage = `Build failed with code ${code}`;
          const fullError = `${errorMessage}\n\nSTDOUT:\n${output}\n\nSTDERR:\n${errorOutput}`;
          
          emitBuildLog(deploymentId, `❌ ${fullError}\n`);
          console.error(`Build failed for deployment ${deploymentId}:`, fullError);
          
          reject(new Error(errorMessage));
        }
      });
      
      childProcess.on('error', (error) => {
        const errorMessage = `Build process error: ${error.message}`;
        emitBuildLog(deploymentId, `❌ ${errorMessage}\n`);
        console.error(`Build process error for deployment ${deploymentId}:`, error);
        reject(new Error(errorMessage));
      });
    });
  }

  private async ensureNextStandaloneOutput(projectDir: string, deploymentId: string) {
    try {
      const nextConfigPath = path.join(projectDir, "next.config.js");
      const nextConfigMjsPath = path.join(projectDir, "next.config.mjs");
      
      // Mevcut next.config dosyasını kontrol et
      let configExists = false;
      let configPath = nextConfigPath;
      
      try {
        await fs.access(nextConfigPath);
        configExists = true;
        emitBuildLog(deploymentId, "Mevcut next.config.js bulundu, standalone output ekleniyor...\n");
      } catch {
        try {
          await fs.access(nextConfigMjsPath);
          configExists = true;
          configPath = nextConfigMjsPath;
          emitBuildLog(deploymentId, "Mevcut next.config.mjs bulundu, standalone output ekleniyor...\n");
        } catch {
          emitBuildLog(deploymentId, "next.config.js bulunamadı, yeni oluşturuluyor...\n");
        }
      }
      
      if (configExists) {
        // Mevcut config'i oku ve standalone output ekle
        const configContent = await fs.readFile(configPath, 'utf-8');
        
        // Standalone output zaten var mı kontrol et
        if (configContent.includes('output:') && configContent.includes('standalone')) {
          emitBuildLog(deploymentId, "Standalone output zaten mevcut.\n");
          return;
        }
        
        // Config'i güncelle
        let updatedConfig = configContent;
        
        // nextConfig objesini bul ve standalone output ekle
        if (configContent.includes('const nextConfig = {')) {
          updatedConfig = configContent.replace(
            /const nextConfig = \{[\s\S]*?\}/,
            (match) => {
              const hasOutput = match.includes('output:');
              if (hasOutput) {
                return match.replace(/output:\s*['"][^'"]*['"]/, "output: 'standalone'");
              } else {
                return match.replace(
                  /const nextConfig = \{/,
                  "const nextConfig = {\n  output: 'standalone',"
                );
              }
            }
          );
        } else if (configContent.includes('module.exports = {')) {
          updatedConfig = configContent.replace(
            /module\.exports = \{[\s\S]*?\}/,
            (match) => {
              const hasOutput = match.includes('output:');
              if (hasOutput) {
                return match.replace(/output:\s*['"][^'"]*['"]/, "output: 'standalone'");
              } else {
                return match.replace(
                  /module\.exports = \{/,
                  "module.exports = {\n  output: 'standalone',"
                );
              }
            }
          );
        } else {
          // Basit config dosyası, standalone output ekle
          updatedConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  ...${configContent.replace(/module\.exports\s*=\s*/, '').replace(/;?\s*$/, '')}
}

module.exports = nextConfig
`;
        }
        
        await fs.writeFile(configPath, updatedConfig);
        emitBuildLog(deploymentId, "next.config.js güncellendi, standalone output eklendi.\n");
        
      } else {
        // Yeni next.config.js oluştur
        const newConfig = `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: {
    outputFileTracingRoot: undefined,
  },
}

module.exports = nextConfig
`;
        
        await fs.writeFile(nextConfigPath, newConfig);
        emitBuildLog(deploymentId, "Yeni next.config.js oluşturuldu, standalone output etkinleştirildi.\n");
      }
      
    } catch (error) {
      emitBuildLog(deploymentId, `next.config.js güncelleme hatası: ${error}\n`);
      console.error("Next.js config güncelleme hatası:", error);
    }
  }

  private async createDockerImage(
    deploymentId: string, 
    projectDir: string, 
    framework: string,
    jobData: BuildJobData
  ): Promise<string> {
    // Dockerfile oluştur
    const dockerfileContent = this.generateDockerfile(framework, jobData);
    const dockerfilePath = path.join(projectDir, "Dockerfile.generated");
    await fs.writeFile(dockerfilePath, dockerfileContent);

    console.log(`📝 Dockerfile oluşturuldu: ${dockerfilePath}`);
    console.log(`📄 Dockerfile içeriği:\n${dockerfileContent}`);

    // Docker image build et
    const imageName = `vercel-clone/${deploymentId}:latest`;
    console.log(`🔨 Docker build başlatılıyor: ${imageName}`);
    
    try {
      const stream = await docker.buildImage(
        {
          context: projectDir,
          src: [".", "Dockerfile.generated"],
        },
        {
          t: imageName,
          dockerfile: "Dockerfile.generated",
        }
      );

      // Build çıktısını takip et ve stream et
      let buildSuccess = false;
      let buildError = null;

      await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err: any, res: any) => {
          if (err) {
            console.error(`❌ Docker build hatası:`, err);
            emitBuildLog(deploymentId, `Docker build hatası: ${err.message}\n`);
            buildError = err;
            reject(err);
          } else {
            console.log(`✅ Docker build tamamlandı:`, res);
            buildSuccess = true;
            emitBuildLog(deploymentId, "Docker image başarıyla oluşturuldu.\n");
            resolve(res);
          }
        }, (event: any) => {
          // Progress events
          if (event.stream) {
            console.log(`🐳 Docker:`, event.stream.trim());
            emitBuildLog(deploymentId, event.stream);
          }
          if (event.error) {
            console.error(`❌ Docker build error:`, event.error);
            emitBuildLog(deploymentId, `Docker error: ${event.error}\n`);
            buildError = event.error;
          }
        });
      });

      // Build başarılı oldu mu kontrol et
      if (!buildSuccess || buildError) {
        throw new Error(`Docker build başarısız: ${buildError || 'Bilinmeyen hata'}`);
      }

      // Image'ın gerçekten oluştuğunu doğrula
      try {
        const imageInfo = await docker.getImage(imageName).inspect();
        console.log(`✅ Image doğrulandı:`, imageInfo.Id);
        emitBuildLog(deploymentId, `Image ID: ${imageInfo.Id}\n`);
      } catch (inspectError) {
        console.error(`❌ Image doğrulama hatası:`, inspectError);
        throw new Error(`Docker image oluşturuldu ama doğrulanamadı: ${inspectError}`);
      }

      return imageName;

    } catch (error) {
      console.error(`❌ Docker build işlemi başarısız:`, error);
      emitBuildLog(deploymentId, `Docker build başarısız: ${error}\n`);
      throw error;
    }
  }

  private generateDockerfile(framework: string, jobData: BuildJobData): string {
    const nodeVersion = jobData.nodeVersion || "18";

    // Next.js için özel Dockerfile
    if (framework === "next") {
      return `FROM node:${nodeVersion}-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \\
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \\
  elif [ -f package-lock.json ]; then npm ci; \\
  elif [ -f pnpm-lock.yaml ]; then yarn global add pnpm && pnpm i --frozen-lockfile; \\
  else echo "Lockfile not found." && exit 1; \\
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the application
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create public directory if it doesn't exist and copy if it does
RUN mkdir -p ./public
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]`;
    }

    // React/Vue için static build
    if (framework === "react" || framework === "vue") {
      const outputDir = this.getDefaultOutputDir(framework);
      return `FROM node:${nodeVersion}-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY --from=builder /app/${outputDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
    }

    // Default Node.js app
    return `FROM node:${nodeVersion}-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["npm", "start"]`;
  }

  private getDefaultOutputDir(framework: string): string {
    switch (framework) {
      case "next":
        return ".next";
      case "react":
        return "build";
      case "vue":
        return "dist";
      default:
        return "dist";
    }
  }

  private async updateDeploymentStatus(deploymentId: string, status: string, buildLogs: string) {
    // Socket.io ile real-time log gönder
    emitBuildLog(deploymentId, `${buildLogs}\n`);
    
    // Veritabanını güncelle
    await db.deployment.update({
      where: { id: deploymentId },
      data: {
        status,
        buildLogs: {
          set: buildLogs,
        },
      },
    });
  }

  private async updateDeploymentUrl(deploymentId: string) {
    const deployment = await db.deployment.findUnique({
      where: { id: deploymentId },
      include: { project: true },
    });

    if (deployment) {
      const url = `https://${deployment.project.name.toLowerCase().replace(/\s+/g, "-")}-${deploymentId.substring(0, 8)}.vercel-clone.app`;
      
      await db.deployment.update({
        where: { id: deploymentId },
        data: { url },
      });
    }
  }

  private async cleanup(projectDir: string) {
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
    } catch (error) {
      console.error("Temizlik hatası:", error);
    }
  }
} 