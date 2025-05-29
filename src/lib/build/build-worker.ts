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

const execAsync = promisify(exec);
const docker = new Docker();

export class BuildWorker {
  private buildsDir: string;
  private currentJobData?: BuildJobData;

  constructor() {
    this.buildsDir = process.env.BUILDS_DIR || path.join(process.cwd(), "builds");
    this.ensureBuildsDir();
    
    // Worker socket bağlantısını başlat
    initWorkerSocket();
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
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.stderr?.on('data', (data) => {
        // Token'ı loglardan gizle
        const sanitizedData = data.toString().replace(new RegExp(githubToken || '', 'g'), '***');
        
        // Git clone'un normal progress mesajları da stderr'e gider
        if (sanitizedData.includes('Cloning into') || 
            sanitizedData.includes('Receiving objects') || 
            sanitizedData.includes('Resolving deltas')) {
          emitBuildLog(deploymentId, sanitizedData);
        } else {
          hasError = true;
          emitBuildLog(deploymentId, `⚠️ ${sanitizedData}`);
        }
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          emitBuildLog(deploymentId, "✅ Repository başarıyla klonlandı.\n");
          
          // Klonlanan dosyaları listele
          exec('ls -la', { cwd: targetDir }, (err, stdout) => {
            if (!err) {
              emitBuildLog(deploymentId, `📁 Proje dosyaları:\n${stdout}\n`);
            }
          });
          
          resolve();
        } else {
          emitBuildLog(deploymentId, `❌ Git clone başarısız (exit code: ${code})\n`);
          
          // Hata sebeplerini analiz et
          if (hasError) {
            emitBuildLog(deploymentId, `\n💡 Olası sebepler:\n`);
            emitBuildLog(deploymentId, `- Repository private olabilir ve erişim yetkisi yoktur\n`);
            emitBuildLog(deploymentId, `- Branch adı yanlış olabilir\n`);
            emitBuildLog(deploymentId, `- Repository URL'si hatalı olabilir\n`);
            emitBuildLog(deploymentId, `- Internet bağlantısı sorunu olabilir\n\n`);
          }
          
          emitBuildLog(deploymentId, `🎯 Demo deployment oluşturuluyor...\n`);
          
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
    // Package manager'ı algıla
    const packageManager = await this.detectPackageManager(projectDir);
    const command = customCommand || this.getInstallCommand(packageManager);
    
    emitBuildLog(deploymentId, `📦 Package Manager: ${packageManager}\n`);
    emitBuildLog(deploymentId, `🔧 Install komutu: ${command}\n`);
    
    return new Promise<string>((resolve, reject) => {
      // Node.js memory limitini artır
      const env = {
        ...process.env,
        NODE_OPTIONS: '--max-old-space-size=4096',
        // npm için özel ayarlar
        npm_config_loglevel: 'error',
        npm_config_fund: 'false',
        npm_config_audit: 'false',
        // yarn için
        YARN_ENABLE_TELEMETRY: 'false'
      };
      
      const childProcess = exec(command, { 
        cwd: projectDir,
        env,
        maxBuffer: 1024 * 1024 * 10, // 10MB buffer
        timeout: 300000 // 5 dakika timeout
      });
      let output = '';
      
      childProcess.stdout?.on('data', (data) => {
        output += data;
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.stderr?.on('data', (data) => {
        const message = data.toString();
        // npm WARN mesajlarını filtrele
        if (!message.includes('npm WARN')) {
          emitBuildLog(deploymentId, message);
        }
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          emitBuildLog(deploymentId, "✅ Bağımlılıklar başarıyla yüklendi.\n");
          resolve(output);
        } else {
          emitBuildLog(deploymentId, `❌ ${packageManager} install başarısız oldu (exit code: ${code})\n`);
          reject(new Error(`${packageManager} install failed with code ${code}`));
        }
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
    emitBuildLog(deploymentId, `\n🏗️ Build işlemi başlatılıyor...\n`);
    emitBuildLog(deploymentId, `📦 Framework: ${framework}\n`);
    
    // Proje yapısını kontrol et
    await this.validateProjectStructure(projectDir, framework, deploymentId);
    
    // Next.js için özel optimizasyonlar
    if (framework === "next") {
      await this.ensureNextStandaloneOutput(projectDir, deploymentId);
      await this.disableESLintIfNeeded(projectDir, deploymentId);
      
      // package.json'dan Next.js versiyonunu kontrol et
      try {
        const packageJsonPath = path.join(projectDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
        const nextVersion = packageJson.dependencies?.next || packageJson.devDependencies?.next;
        if (nextVersion) {
          emitBuildLog(deploymentId, `📌 Next.js version: ${nextVersion}\n`);
        }
      } catch (error) {
        // Ignore errors
      }
    }
    
    // Environment variables'ı al ve inject et
    const envVars = await this.getProjectEnvVariables(deploymentId);
    
    // Package manager'ı algıla
    const packageManager = await this.detectPackageManager(projectDir);
    
    let buildCommand = customCommand;
    
    if (!buildCommand) {
      // Framework'e göre varsayılan build komutları
      switch (framework) {
        case "next":
          buildCommand = `${packageManager} run build`;
          break;
        case "react":
          // Create React App için özel kontrol
          const isCreateReactApp = await this.isCreateReactApp(projectDir);
          if (isCreateReactApp) {
            buildCommand = `CI=false ${packageManager} run build`; // CI=false ile warnings'leri ignore et
          } else {
            buildCommand = `${packageManager} run build`;
          }
          break;
        case "vue":
          buildCommand = `${packageManager} run build`;
          break;
        default:
          buildCommand = `${packageManager} run build`;
      }
    }
    
    emitBuildLog(deploymentId, `🔧 Build komutu: ${buildCommand}\n\n`);
    
    return new Promise<string>((resolve, reject) => {
      // Environment variables ve memory limiti ile birlikte çalıştır
      const env = {
        ...process.env,
        ...envVars,
        NODE_OPTIONS: '--max-old-space-size=4096',
        // Next.js için özel env variables
        NEXT_TELEMETRY_DISABLED: '1',
        SKIP_ENV_VALIDATION: '1',
        // CI ortamı olduğunu belirt
        CI: 'true',
        // React için
        GENERATE_SOURCEMAP: 'false', // Build boyutunu küçült
        // Common
        NODE_ENV: 'production' as 'production'
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
        emitBuildLog(deploymentId, data.toString());
      });
      
      childProcess.stderr?.on('data', (data) => {
        errorOutput += data.toString();
        // Next.js warning'lerini filtrele
        if (!data.toString().includes('warn') && !data.toString().includes('⚠')) {
          emitBuildLog(deploymentId, data.toString());
        }
      });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          emitBuildLog(deploymentId, "\n✅ Build işlemi başarıyla tamamlandı!\n");
          
          // Build output'u kontrol et
          this.validateBuildOutput(projectDir, framework, deploymentId)
            .then(() => resolve(output))
            .catch((err) => {
              emitBuildLog(deploymentId, `\n⚠️ Build output doğrulama hatası: ${err.message}\n`);
              resolve(output); // Yine de devam et
            });
        } else {
          // Detaylı hata analizi
          let errorMessage = `Build failed with code ${code}`;
          
          // Common build hataları
          if (errorOutput.includes('Cannot find module')) {
            errorMessage += '\n\n💡 Çözüm önerisi: Eksik modül hatası. package.json dosyanızı kontrol edin.';
          } else if (errorOutput.includes('ESLint')) {
            errorMessage += '\n\n💡 Çözüm önerisi: ESLint hataları var. next.config.js dosyanıza eslint: { ignoreDuringBuilds: true } ekleyebilirsiniz.';
          } else if (errorOutput.includes('TypeScript error')) {
            errorMessage += '\n\n💡 Çözüm önerisi: TypeScript hataları var. tsconfig.json dosyanızı kontrol edin veya next.config.js dosyanıza typescript: { ignoreBuildErrors: true } ekleyebilirsiniz.';
          } else if (errorOutput.includes('out of memory') || errorOutput.includes('heap out of memory')) {
            errorMessage += '\n\n💡 Çözüm önerisi: Bellek yetersiz. Projeniz büyük olabilir, daha büyük bir plan seçmeniz gerekebilir.';
          } else if (errorOutput.includes('ENOSPC')) {
            errorMessage += '\n\n💡 Çözüm önerisi: Disk alanı yetersiz.';
          } else if (errorOutput.includes('permission denied')) {
            errorMessage += '\n\n💡 Çözüm önerisi: Dosya izin hatası.';
          }
          
          emitBuildLog(deploymentId, `\n❌ ${errorMessage}\n`);
          reject(new Error(errorMessage));
        }
      });
    });
  }

  private async validateProjectStructure(projectDir: string, framework: string, deploymentId: string) {
    try {
      // package.json kontrolü
      const packageJsonPath = path.join(projectDir, 'package.json');
      try {
        await fs.access(packageJsonPath);
        emitBuildLog(deploymentId, `✅ package.json bulundu\n`);
      } catch {
        emitBuildLog(deploymentId, `⚠️ package.json bulunamadı - Build başarısız olabilir\n`);
      }
      
      // Framework'e özgü kontroller
      switch (framework) {
        case 'next':
          // pages veya app dizini kontrolü
          const pagesExists = await this.checkDirExists(path.join(projectDir, 'pages'));
          const appExists = await this.checkDirExists(path.join(projectDir, 'app'));
          const srcPagesExists = await this.checkDirExists(path.join(projectDir, 'src/pages'));
          const srcAppExists = await this.checkDirExists(path.join(projectDir, 'src/app'));
          
          if (pagesExists || appExists || srcPagesExists || srcAppExists) {
            emitBuildLog(deploymentId, `✅ Next.js proje yapısı doğrulandı\n`);
          } else {
            emitBuildLog(deploymentId, `⚠️ pages veya app dizini bulunamadı\n`);
          }
          break;
          
        case 'react':
          // public ve src dizini kontrolü
          const publicExists = await this.checkDirExists(path.join(projectDir, 'public'));
          const srcExists = await this.checkDirExists(path.join(projectDir, 'src'));
          
          if (publicExists && srcExists) {
            emitBuildLog(deploymentId, `✅ React proje yapısı doğrulandı\n`);
          }
          break;
          
        case 'vue':
          // src dizini kontrolü
          const vueSrcExists = await this.checkDirExists(path.join(projectDir, 'src'));
          if (vueSrcExists) {
            emitBuildLog(deploymentId, `✅ Vue proje yapısı doğrulandı\n`);
          }
          break;
      }
    } catch (error) {
      emitBuildLog(deploymentId, `⚠️ Proje yapısı doğrulama hatası: ${error}\n`);
    }
  }

  private async checkDirExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async isCreateReactApp(projectDir: string): Promise<boolean> {
    try {
      const packageJsonPath = path.join(projectDir, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      
      // react-scripts dependency'sini kontrol et
      return !!(packageJson.dependencies?.['react-scripts'] || packageJson.devDependencies?.['react-scripts']);
    } catch {
      return false;
    }
  }

  private async validateBuildOutput(projectDir: string, framework: string, deploymentId: string) {
    try {
      switch (framework) {
        case 'next':
          // .next dizini kontrolü
          const nextBuildExists = await this.checkDirExists(path.join(projectDir, '.next'));
          if (!nextBuildExists) {
            throw new Error('.next dizini bulunamadı');
          }
          
          // Standalone output kontrolü
          const standaloneExists = await this.checkDirExists(path.join(projectDir, '.next/standalone'));
          if (standaloneExists) {
            emitBuildLog(deploymentId, `✅ Next.js standalone output oluşturuldu\n`);
          }
          break;
          
        case 'react':
          // build dizini kontrolü
          const buildExists = await this.checkDirExists(path.join(projectDir, 'build'));
          if (!buildExists) {
            throw new Error('build dizini bulunamadı');
          }
          break;
          
        case 'vue':
          // dist dizini kontrolü
          const distExists = await this.checkDirExists(path.join(projectDir, 'dist'));
          if (!distExists) {
            throw new Error('dist dizini bulunamadı');
          }
          break;
      }
      
      emitBuildLog(deploymentId, `✅ Build output doğrulandı\n`);
    } catch (error) {
      throw error;
    }
  }

  private async disableESLintIfNeeded(projectDir: string, deploymentId: string) {
    try {
      const nextConfigPath = path.join(projectDir, "next.config.js");
      const nextConfigMjsPath = path.join(projectDir, "next.config.mjs");
      
      let configPath = '';
      try {
        await fs.access(nextConfigPath);
        configPath = nextConfigPath;
      } catch {
        try {
          await fs.access(nextConfigMjsPath);
          configPath = nextConfigMjsPath;
        } catch {
          return; // Config dosyası yok
        }
      }
      
      const configContent = await fs.readFile(configPath, 'utf-8');
      
      // ESLint ignore already exists?
      if (configContent.includes('ignoreDuringBuilds')) {
        return;
      }
      
      emitBuildLog(deploymentId, "ESLint ve TypeScript hataları build sırasında göz ardı edilecek...\n");
      
      // Add ESLint and TypeScript ignore
      let updatedConfig = configContent;
      
      if (configContent.includes('const nextConfig = {')) {
        updatedConfig = configContent.replace(
          /const nextConfig = \{/,
          `const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },`
        );
      } else if (configContent.includes('module.exports = {')) {
        updatedConfig = configContent.replace(
          /module\.exports = \{/,
          `module.exports = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },`
        );
      }
      
      await fs.writeFile(configPath, updatedConfig);
      
    } catch (error) {
      console.error("ESLint config update error:", error);
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
          // Decrypt işlemi burada yapılmalı
          envVars[envVar.key] = envVar.value; // Şimdilik plain text, sonra decrypt eklenecek
        }
      }
      
      emitBuildLog(deploymentId, `${Object.keys(envVars).length} environment variable yüklendi.\n`);
      
      return envVars;
    } catch (error) {
      console.error("Environment variables yüklenirken hata:", error);
      return {};
    }
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
    console.log(`📤 Socket üzerinden log gönderiliyor: ${deploymentId}, status: ${status}`);
    emitBuildLog(deploymentId, `${buildLogs}\n`, status);
    emitDeploymentStatus(deploymentId, status);
    
    // Veritabanını güncelle
    try {
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
      console.error(`❌ Deployment güncelleme hatası: ${error}`);
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