import { Job } from "bull";
import { BuildJobData } from "../queue/build-queue";
import { db } from "@/lib/db";
import Docker from "dockerode";
import { promises as fs } from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { emitBuildLogFromWorker as emitBuildLog, emitDeploymentStatusFromWorker as emitDeploymentStatus, initWorkerSocket } from "../socket/socket-client";
import { startDeploymentContainer } from "../deployment-service";
import { createDeploymentComment } from "../github/pr-comments";
import { decrypt, isEncrypted } from "../encryption";

const execAsync = promisify(exec);
const docker = new Docker();

// Dosya sistemi bazlı log yapılandırması
const LOG_DIR = process.env.LOG_DIR || path.join(process.cwd(), "logs");
const WORKER_ID = process.env.pm_id || Date.now().toString();
const LOG_FILE_PATH = path.join(LOG_DIR, `worker-${WORKER_ID}.log`);

// Log fonksiyonu
async function logToFile(message: string, level: 'INFO' | 'ERROR' | 'WARN' = 'INFO') {
  try {
    // Dizinin varlığını kontrol et, yoksa oluştur
    await fs.mkdir(LOG_DIR, { recursive: true });
    
    // Log formatını oluştur: [TIMESTAMP] [LEVEL] Message
    const timestamp = new Date().toISOString();
    const formattedMessage = `${timestamp} [${level}] ${message}\n`;
    
    // Dosyaya ekle (append)
    await fs.appendFile(LOG_FILE_PATH, formattedMessage);
    
    // Konsola da yazdır
    if (level === 'ERROR') {
      console.error(formattedMessage.trim());
    } else if (level === 'WARN') {
      console.warn(formattedMessage.trim());
    } else {
      console.log(formattedMessage.trim());
    }
  } catch (err) {
    // Loglama bile başarısız olduysa sadece konsola yazdır
    console.error(`Log dosyasına yazılamadı: ${err}`);
    console.error(message);
  }
}

export class BuildWorker {
  private buildsDir: string;
  private currentJobData?: BuildJobData;

  constructor() {
    this.buildsDir = process.env.BUILDS_DIR || path.join(process.cwd(), "builds");
    this.ensureBuildsDir();
    
    // Worker socket bağlantısını başlat
    initWorkerSocket();
    
    // Worker başlatma logu
    logToFile(`Build worker başlatıldı. Worker ID: ${WORKER_ID}, Log dosyası: ${LOG_FILE_PATH}`);
    logToFile(`Build worker başlatıldı ve job'ları bekliyor...`);
  }

  private async ensureBuildsDir() {
    try {
      await fs.mkdir(this.buildsDir, { recursive: true });
    } catch (error) {
      await logToFile(`Build dizini oluşturulamadı: ${error}`, 'ERROR');
      console.error("Build dizini oluşturulamadı:", error);
    }
  }

  async processBuildJob(job: Job<BuildJobData>) {
    const { deploymentId, projectId, repoUrl, branch, commit, framework } = job.data;
    
    // Job data'yı class property'ye ata (cloneRepository'de kullanmak için)
    this.currentJobData = job.data;
    
    try {
      await logToFile(`Build job başlatıldı: ${job.id} - Deployment: ${deploymentId}`);
      await logToFile(`Job data: ${JSON.stringify(job.data, null, 2)}`);
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
      
      await logToFile(`Build job başarılı: ${job.id} - Deployment: ${deploymentId}`);

      return {
        success: true,
        deploymentId,
        imageName,
        url,
      };
    } catch (error) {
      const errorMessage = error instanceof Error 
        ? `${error.message}\n${error.stack || ''}` 
        : String(error);
      
      await logToFile(`Build job başarısız: ${job.id} ${errorMessage}`, 'ERROR');
      console.error(`❌ Build hatası (${deploymentId}):`, error);
      
      // Socket client'a detaylı hata bilgisi gönder
      try {
        emitBuildLog(deploymentId, `\n❌ Hata Detayı: ${errorMessage}\n`, "ERROR");
      } catch (socketError) {
        await logToFile(`Socket log gönderilemedi: ${socketError}`, 'ERROR');
      }
      
      await this.updateDeploymentStatus(
        deploymentId, 
        "FAILED", 
        `Build hatası: ${error instanceof Error ? error.message : "Bilinmeyen hata"}`
      );
      
      // PR comment güncelle (eğer preview deployment ise)
      try {
        const deployment = await db.deployment.findUnique({
          where: { id: deploymentId }
        });
        
        if (deployment?.isPreview) {
          await createDeploymentComment(deploymentId, "failed");
        }
      } catch (commentError) {
        await logToFile(`PR yorum güncelleme hatası: ${commentError}`, 'ERROR');
      }
      
      throw error;
    }
  }

  private async cloneRepository(repoUrl: string, branch: string, targetDir: string, deploymentId: string) {
    // User'ın GitHub token'ını job data'dan al
    const jobData = this.currentJobData;
    const githubToken = jobData?.githubAccessToken || process.env.GITHUB_TOKEN || process.env.GITHUB_SECRET;
    
    let cloneUrl = repoUrl;
    
    // GitHub repo ise token ekle
    if (repoUrl.includes('github.com') && githubToken) {
      // https://github.com/user/repo.git -> https://token@github.com/user/repo.git
      cloneUrl = repoUrl.replace('https://github.com/', `https://${githubToken}@github.com/`);
      emitBuildLog(deploymentId, `🔐 GitHub token ile kimlik doğrulama yapılıyor...\n`);
    }
    
    // Git versiyonunu kontrol et
    try {
      const { stdout: gitVersion } = await execAsync('git --version');
      emitBuildLog(deploymentId, `📌 ${gitVersion.trim()}\n`);
    } catch (error) {
      const errorMsg = `Git versiyonu kontrol edilemedi: ${error}`;
      await logToFile(errorMsg, 'ERROR');
      emitBuildLog(deploymentId, `⚠️ Git bulunamadı veya erişilemiyor\n`);
    }
    
    const command = `git clone --depth 1 --branch ${branch} "${cloneUrl}" .`;
    emitBuildLog(deploymentId, `🔄 Repository klonlanıyor: ${repoUrl}\n`);
    emitBuildLog(deploymentId, `📌 Branch: ${branch}\n`);
    
    return new Promise<void>((resolve, reject) => {
      const childProcess = exec(command, { 
        cwd: targetDir,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0', // Git'in interaktif prompt'larını devre dışı bırak
          GIT_SSH_COMMAND: 'ssh -o StrictHostKeyChecking=no' // SSH key kontrolünü devre dışı bırak
        }
      });
      
      let hasError = false;
      
      childProcess.stdout?.on('data', (data) => {
        const message = data.toString();
        emitBuildLog(deploymentId, message);
        logToFile(`[Git Clone] ${message.trim()}`);
      });
      
      childProcess.stderr?.on('data', (data) => {
        // Token'ı loglardan gizle
        const sanitizedData = data.toString().replace(new RegExp(githubToken || '', 'g'), '***');
        
        // Git clone'un normal progress mesajları da stderr'e gider
        if (sanitizedData.includes('Cloning into') || 
            sanitizedData.includes('Receiving objects') || 
            sanitizedData.includes('Resolving deltas')) {
          emitBuildLog(deploymentId, sanitizedData);
          logToFile(`[Git Clone] ${sanitizedData.trim()}`);
        } else {
          hasError = true;
          const errorMsg = `⚠️ ${sanitizedData}`;
          emitBuildLog(deploymentId, errorMsg);
          logToFile(`[Git Clone Error] ${sanitizedData.trim()}`, 'WARN');
        }
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          const successMsg = "✅ Repository başarıyla klonlandı.";
          emitBuildLog(deploymentId, successMsg + "\n");
          logToFile(successMsg);
          
          // Klonlanan dosyaları listele
          exec('ls -la', { cwd: targetDir }, (err, stdout) => {
            if (!err) {
              const filesMsg = `📁 Proje dosyaları:\n${stdout}\n`;
              emitBuildLog(deploymentId, filesMsg);
              logToFile(filesMsg);
            } else {
              logToFile(`Dosya listesi alınamadı: ${err}`, 'WARN');
            }
          });
          
          resolve();
        } else {
          const errorMsg = `❌ Git clone başarısız (exit code: ${code})`;
          emitBuildLog(deploymentId, errorMsg + "\n");
          logToFile(errorMsg, 'ERROR');
          reject(new Error(`Git clone failed with code ${code}`));
        }
      });
      
      childProcess.on('error', (error) => {
        const errorMsg = `Git clone process error: ${error.message}`;
        logToFile(errorMsg, 'ERROR');
        emitBuildLog(deploymentId, `❌ ${errorMsg}\n`);
        reject(error);
      });
    });
  }

  private async installDependencies(projectDir: string, customCommand: string | undefined, deploymentId: string) {
    // Package manager'ı algıla
    let packageManager;
    try {
      packageManager = await this.detectPackageManager(projectDir);
    } catch (error) {
      const errorMsg = `Package manager algılanamadı: ${error}`;
      await logToFile(errorMsg, 'ERROR');
      emitBuildLog(deploymentId, `⚠️ ${errorMsg}\n`);
      packageManager = 'npm'; // Fallback olarak npm kullan
    }
    
    const command = customCommand || this.getInstallCommand(packageManager);
    
    emitBuildLog(deploymentId, `📦 Package Manager: ${packageManager}\n`);
    emitBuildLog(deploymentId, `🔧 Install komutu: ${command}\n`);
    logToFile(`Install başlatılıyor: ${command} (package manager: ${packageManager})`);
    
    return new Promise<string>((resolve, reject) => {
      // NODE_ENV production olarak ayarla (Vercel default)
      const env = {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096',
        NODE_ENV: 'production' as 'production',
        // npm için özel ayarlar
        npm_config_loglevel: 'error',
        npm_config_fund: 'false',
        npm_config_audit: 'false',
        // yarn için
        YARN_ENABLE_TELEMETRY: 'false',
      };
      
      const childProcess = exec(command, { 
        cwd: projectDir,
        env,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 300000 // 5 dakika timeout
      });
      let output = '';
      let errorOutput = '';
      
      childProcess.stdout?.on('data', (data) => {
        output += data;
        const message = data.toString();
        emitBuildLog(deploymentId, message);
        // Çok fazla log oluşmaması için sadece önemli mesajları dosyaya yaz
        if (message.includes('added') || message.includes('removed') || message.includes('updated')) {
          logToFile(`[Install] ${message.trim()}`);
        }
      });
      
      childProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        errorOutput += message;
        // npm WARN mesajlarını filtrele
        if (!message.includes('npm WARN deprecated')) {
          emitBuildLog(deploymentId, message);
          logToFile(`[Install Error] ${message.trim()}`, 'WARN');
        }
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          const successMsg = "✅ Bağımlılıklar başarıyla yüklendi.";
          emitBuildLog(deploymentId, successMsg + "\n");
          logToFile(successMsg);
          resolve(output);
        } else {
          const errorMsg = `❌ ${packageManager} install başarısız oldu (exit code: ${code})`;
          emitBuildLog(deploymentId, errorMsg + "\n");
          if (errorOutput) {
            emitBuildLog(deploymentId, `📋 Hata detayı:\n${errorOutput}\n`);
          }
          logToFile(errorMsg, 'ERROR');
          logToFile(`Install error detayı: ${errorOutput}`, 'ERROR');
          reject(new Error(`${packageManager} install failed with code ${code}`));
        }
      });
      
      childProcess.on('error', (error) => {
        const errorMsg = `Installation process error: ${error.message}`;
        logToFile(errorMsg, 'ERROR');
        emitBuildLog(deploymentId, `❌ ${errorMsg}\n`);
        reject(error);
      });
    });
  }

  private async detectPackageManager(projectDir: string): Promise<string> {
    try {
      // pnpm-lock.yaml kontrolü
      await fs.access(path.join(projectDir, 'pnpm-lock.yaml'));
      return 'pnpm';
    } catch {}
    
    try {
      // yarn.lock kontrolü
      await fs.access(path.join(projectDir, 'yarn.lock'));
      return 'yarn';
    } catch {}
    
    try {
      // package-lock.json kontrolü
      await fs.access(path.join(projectDir, 'package-lock.json'));
      return 'npm';
    } catch {}
    
    // Default olarak npm kullan
    return 'npm';
  }

  private getInstallCommand(packageManager: string): string {
    switch (packageManager) {
      case 'pnpm':
        return 'pnpm install --frozen-lockfile';
      case 'yarn':
        return 'yarn install --frozen-lockfile';
      case 'npm':
      default:
        return 'npm ci || npm install';
    }
  }

  private async buildProject(projectDir: string, framework: string, customCommand: string | undefined, deploymentId: string) {
    try {
      // Environment variables'ı al
      let envVars;
      try {
        envVars = await this.getProjectEnvVariables(deploymentId);
        logToFile(`${deploymentId} için environment variables alındı: ${Object.keys(envVars).length} adet`);
      } catch (envError) {
        const errorMsg = `Environment variables alınamadı: ${envError}`;
        await logToFile(errorMsg, 'ERROR');
        emitBuildLog(deploymentId, `⚠️ ${errorMsg}\n`);
        envVars = {};
      }
      
      // Environment dosyası oluştur
      if (Object.keys(envVars).length > 0) {
        try {
          await this.createEnvFile(projectDir, envVars, deploymentId);
        } catch (envFileError) {
          const errorMsg = `Environment dosyası oluşturulamadı: ${envFileError}`;
          await logToFile(errorMsg, 'ERROR');
          emitBuildLog(deploymentId, `⚠️ ${errorMsg}\n`);
        }
      }
      
      // Package manager'ı algıla
      let packageManager;
      try {
        packageManager = await this.detectPackageManager(projectDir);
      } catch (pmError) {
        const errorMsg = `Package manager algılanamadı: ${pmError}`;
        await logToFile(errorMsg, 'ERROR');
        packageManager = 'npm'; // Fallback olarak npm
      }
      
      // Build komutu
      const buildCommand = customCommand || this.getDefaultBuildCommand(packageManager, framework);
      
      emitBuildLog(deploymentId, `🔧 Build komutu: ${buildCommand}\n\n`);
      logToFile(`Build başlatılıyor: ${buildCommand} (framework: ${framework})`);
      
      // Vercel'in yaptığı gibi - Next.js versiyonunu logla
      if (framework === "next") {
        try {
          const packageJsonPath = path.join(projectDir, 'package.json');
          const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
          const nextVersion = packageJson.dependencies?.next || packageJson.devDependencies?.next;
          if (nextVersion) {
            const versionMsg = `   ▲ Next.js ${nextVersion}`;
            emitBuildLog(deploymentId, versionMsg + "\n");
            logToFile(versionMsg);
          }
        } catch (error) {
          logToFile(`Next.js versiyonu okunamadı: ${error}`, 'WARN');
        }
      }
      
      return new Promise<string>((resolve, reject) => {
        // Environment variables ile birlikte çalıştır
        const env = {
          ...process.env,
          ...envVars,
          NODE_OPTIONS: '--max-old-space-size=4096',
          NODE_ENV: 'production' as 'production',
          // CI ortamı
          CI: 'true',
          // Vercel benzeri environment variables
          VERCEL: '1' as '1',
          VERCEL_ENV: 'production',
          // Next.js için
          NEXT_TELEMETRY_DISABLED: '1',
        };
        
        const childProcess = exec(buildCommand, { 
          cwd: projectDir,
          env,
          maxBuffer: 1024 * 1024 * 50, // 50MB buffer
          timeout: 600000 // 10 dakika timeout
        });
        
        let output = '';
        let errorOutput = '';
        
        childProcess.stdout?.on('data', (data) => {
          output += data;
          const message = data.toString();
          emitBuildLog(deploymentId, message);
          // Önemli mesajları dosyaya yaz
          if (message.includes('Error') || message.includes('Warning') || 
              message.includes('Built') || message.includes('Compiled') ||
              message.includes('Failed')) {
            logToFile(`[Build] ${message.trim()}`);
          }
        });
        
        childProcess.stderr?.on('data', (data) => {
          const message = data.toString();
          errorOutput += message;
          emitBuildLog(deploymentId, message);
          logToFile(`[Build Error] ${message.trim()}`, 'WARN');
        });
        
        childProcess.on('close', (code) => {
          if (code === 0) {
            const successMsg = "\n✅ Build işlemi başarıyla tamamlandı!";
            emitBuildLog(deploymentId, successMsg + "\n");
            logToFile(successMsg);
            resolve(output);
          } else {
            const errorMsg = `\n❌ Build failed with code ${code}`;
            emitBuildLog(deploymentId, errorMsg + "\n");
            if (errorOutput) {
              const detailMsg = `📋 Build Hatası Detayı:\n${errorOutput}`;
              emitBuildLog(deploymentId, detailMsg + "\n");
            }
            logToFile(errorMsg, 'ERROR');
            logToFile(`Build error detayı: ${errorOutput}`, 'ERROR');
            reject(new Error(`Build failed with code ${code}`));
          }
        });
        
        childProcess.on('error', (error) => {
          const errorMsg = `Build process error: ${error.message}`;
          logToFile(errorMsg, 'ERROR');
          emitBuildLog(deploymentId, `❌ ${errorMsg}\n`);
          reject(error);
        });
      });
    } catch (error) {
      const errorMsg = `❌ Build hatası (${deploymentId}): ${error}`;
      await logToFile(errorMsg, 'ERROR');
      console.error(errorMsg);
      throw error;
    }
  }

  private getDefaultBuildCommand(packageManager: string, framework: string): string {
    // Vercel'in varsayılan build komutları
    switch (framework) {
      case 'next':
        return `${packageManager} run build`;
      case 'react':
        return `${packageManager} run build`;
      case 'vue':
        return `${packageManager} run build`;
      default:
        return `${packageManager} run build`;
    }
  }

  private async createEnvFile(projectDir: string, envVars: Record<string, string>, deploymentId: string): Promise<void> {
    try {
      // Environment variables içeriğini oluştur
      let envContent = '';
      for (const [key, value] of Object.entries(envVars)) {
        envContent += `${key}=${value}\n`;
      }
      
      // Vercel gibi .env.production.local dosyası oluştur
      const envPath = path.join(projectDir, '.env.production.local');
      await fs.writeFile(envPath, envContent);
      
      emitBuildLog(deploymentId, `   - Environments: .env.production.local\n\n`);
    } catch (error) {
      console.error("Env dosyası oluşturma hatası:", error);
    }
  }

  private async getProjectEnvVariables(deploymentId: string): Promise<Record<string, string>> {
    try {
      const deployment = await db.deployment.findUnique({
        where: { id: deploymentId },
        include: {
          project: {
            include: {
              envVariables: true
            }
          }
        }
      });
      
      if (!deployment?.project?.envVariables) {
        return {};
      }
      
      const envVars: Record<string, string> = {};
      
      // Environment variables'ı decrypt et ve hazırla
      for (const envVar of deployment.project.envVariables) {
        // Production deployment ise production, değilse preview target'ı kullan
        const isProduction = deployment.branch === 'main' || deployment.branch === 'master';
        const target = isProduction ? 'production' : 'preview';
        
        if (envVar.target.includes(target) || envVar.target.includes('development')) {
          // Decrypt işlemi ile şifrelenmiş değeri çöz
          envVars[envVar.key] = decrypt(envVar.value);
        }
      }
      
      return envVars;
    } catch (error) {
      console.error("Environment variables yüklenirken hata:", error);
      return {};
    }
  }

  private async createDockerImage(
    deploymentId: string, 
    projectDir: string, 
    framework: string,
    jobData: BuildJobData
  ): Promise<string> {
    try {
      // Dockerfile oluştur
      const dockerfileContent = this.generateDockerfile(framework, jobData);
      const dockerfilePath = path.join(projectDir, "Dockerfile.generated");
      await fs.writeFile(dockerfilePath, dockerfileContent);

      const dockerfileMsg = `📝 Dockerfile oluşturuldu: ${dockerfilePath}`;
      console.log(dockerfileMsg);
      await logToFile(dockerfileMsg);
      await logToFile(`📄 Dockerfile içeriği:\n${dockerfileContent}`);

      // Docker image build et
      const imageName = `vercel-clone/${deploymentId}:latest`;
      const buildMsg = `🔨 Docker build başlatılıyor: ${imageName}`;
      console.log(buildMsg);
      await logToFile(buildMsg);
      
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

        await new Promise<void>((resolve, reject) => {
          docker.modem.followProgress(stream, (err: any, res: any) => {
            if (err) {
              const errorMsg = `❌ Docker build hatası: ${err}`;
              console.error(errorMsg);
              logToFile(errorMsg, 'ERROR');
              emitBuildLog(deploymentId, `Docker build hatası: ${err.message}\n`);
              buildError = err;
              reject(err);
            } else {
              const successMsg = `✅ Docker build tamamlandı`;
              console.log(successMsg);
              logToFile(successMsg);
              buildSuccess = true;
              emitBuildLog(deploymentId, "Docker image başarıyla oluşturuldu.\n");
              resolve();
            }
          }, (event: any) => {
            // Progress events
            if (event.stream) {
              const message = event.stream.trim();
              console.log(`🐳 Docker:`, message);
              
              if (message) {
                emitBuildLog(deploymentId, event.stream);
                // Önemli Docker olaylarını logla
                if (message.includes('Step') || message.includes('error') || 
                    message.includes('Successfully built') || message.includes('failed')) {
                  logToFile(`[Docker] ${message}`);
                }
              }
            }
            if (event.error) {
              const errorMsg = `❌ Docker build error: ${event.error}`;
              console.error(errorMsg);
              logToFile(errorMsg, 'ERROR');
              emitBuildLog(deploymentId, `Docker error: ${event.error}\n`);
              buildError = event.error;
            }
          });
        });

        // Build başarılı oldu mu kontrol et
        if (!buildSuccess || buildError) {
          const errorMsg = `Docker build başarısız: ${buildError || 'Bilinmeyen hata'}`;
          await logToFile(errorMsg, 'ERROR');
          throw new Error(errorMsg);
        }

        // Image'ın gerçekten oluştuğunu doğrula
        try {
          const imageInfo = await docker.getImage(imageName).inspect();
          const successMsg = `✅ Image doğrulandı: ${imageInfo.Id}`;
          console.log(successMsg);
          await logToFile(successMsg);
          emitBuildLog(deploymentId, `Image ID: ${imageInfo.Id}\n`);
        } catch (inspectError) {
          const errorMsg = `❌ Image doğrulama hatası: ${inspectError}`;
          console.error(errorMsg);
          await logToFile(errorMsg, 'ERROR');
          throw new Error(`Docker image oluşturuldu ama doğrulanamadı: ${inspectError}`);
        }

        return imageName;

      } catch (error) {
        const errorMsg = `❌ Docker build işlemi başarısız: ${error}`;
        console.error(errorMsg);
        await logToFile(errorMsg, 'ERROR');
        emitBuildLog(deploymentId, `Docker build başarısız: ${error}\n`);
        throw error;
      }
    } catch (error) {
      const errorMsg = `Docker image oluşturma hatası: ${error}`;
      await logToFile(errorMsg, 'ERROR');
      throw error;
    }
  }

  private generateDockerfile(framework: string, jobData: BuildJobData): string {
    const nodeVersion = jobData.nodeVersion || "18";

    // Next.js için özel Dockerfile (Vercel'in yaklaşımı)
    if (framework === "next") {
      return `FROM node:${nodeVersion}-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./

# Install dependencies
RUN \\
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \\
  elif [ -f package-lock.json ]; then npm ci; \\
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \\
  else echo "Lockfile not found." && exit 1; \\
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Environment variables
ENV NEXT_TELEMETRY_DISABLED 1

# Build
RUN \\
  if [ -f yarn.lock ]; then yarn build; \\
  elif [ -f package-lock.json ]; then npm run build; \\
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm build; \\
  else npm run build; \\
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy public assets
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Standalone yapı varsa kullan, yoksa normal yapıyı kullan
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone* ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Eğer standalone yoksa, tüm projeyi kopyala
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules || true
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next || true

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Standalone varsa server.js, yoksa next start kullan
CMD if [ -f server.js ]; then node server.js; else npm start; fi`;
    }

    // React/Vue için static build
    if (framework === "react" || framework === "vue") {
      const outputDir = this.getDefaultOutputDir(framework);
      return `FROM node:${nodeVersion}-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN \\
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \\
  elif [ -f package-lock.json ]; then npm ci; \\
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \\
  else npm ci; \\
  fi

COPY . .
RUN npm run build

# Production stage with nginx
FROM nginx:alpine
COPY --from=builder /app/${outputDir} /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN echo 'server { \\
    listen 80; \\
    location / { \\
        root /usr/share/nginx/html; \\
        try_files $uri /index.html; \\
    } \\
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`;
    }

    // Default Node.js app
    return `FROM node:${nodeVersion}-alpine

WORKDIR /app

# Copy package files
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
    try {
      // Socket.io ile real-time log gönder
      console.log(`📤 Socket üzerinden log gönderiliyor: ${deploymentId}, status: ${status}`);
      await logToFile(`Deployment status güncelleniyor: ${deploymentId}, status: ${status}`);
      
      emitBuildLog(deploymentId, `${buildLogs}\n`, status);
      emitDeploymentStatus(deploymentId, status);
      
      // Veritabanını güncelle
      await db.deployment.update({
        where: { id: deploymentId },
        data: {
          status,
          buildLogs: {
            set: buildLogs + "\n",
          },
        },
      });
      console.log(`✅ Deployment veritabanında güncellendi: ${deploymentId}, status: ${status}`);
    } catch (error) {
      const errorMsg = `❌ Deployment güncelleme hatası: ${error}`;
      console.error(errorMsg);
      await logToFile(errorMsg, 'ERROR');
      // Bu fonksiyon içindeki hata, üst fonksiyona iletilmemeli (kritik değil)
    }
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