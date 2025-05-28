import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import crypto from "crypto";
import { addBuildJob } from "@/lib/queue/build-queue";
import { createDeploymentComment, cleanupPreviewDeployment } from "@/lib/github/pr-comments";

// GitHub webhook secret'ını doğrula
function verifyGitHubWebhook(payload: string, signature: string, secret: string): boolean {
  const hmac = crypto.createHmac("sha256", secret);
  const digest = `sha256=${hmac.update(payload).digest("hex")}`;
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event");

    if (!signature || !event) {
      return NextResponse.json(
        { error: "Geçersiz webhook isteği" },
        { status: 400 }
      );
    }

    // Webhook'u parse et
    const payload = JSON.parse(body);

    // Repository URL'inden projeyi bul
    const repoUrl = payload.repository?.html_url;
    if (!repoUrl) {
      return NextResponse.json(
        { error: "Repository URL bulunamadı" },
        { status: 400 }
      );
    }

    // Projeyi veritabanından bul
    const project = await db.project.findFirst({
      where: {
        repoUrl,
      },
      include: {
        webhooks: true,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Bu repository için proje bulunamadı" },
        { status: 404 }
      );
    }

    // Webhook secret'ını doğrula
    const webhook = project.webhooks.find(w => w.active);
    if (webhook && webhook.secret) {
      const isValid = verifyGitHubWebhook(body, signature, webhook.secret);
      if (!isValid) {
        return NextResponse.json(
          { error: "Geçersiz webhook imzası" },
          { status: 401 }
        );
      }
    }

    // Event tipine göre işlem yap
    switch (event) {
      case "push":
        // Push event'i - yeni deployment başlat
        const branch = payload.ref?.replace("refs/heads/", "");
        const commit = payload.after || payload.head_commit?.id;
        const commitMessage = payload.head_commit?.message;

        // Auto deploy aktifse ve doğru branch'e push yapıldıysa
        if (project.autoDeployEnabled && branch === project.gitBranch) {
          // Yeni deployment oluştur
          const deployment = await db.deployment.create({
            data: {
              projectId: project.id,
              status: "PENDING",
              commit,
              commitMessage,
              branch,
              buildLogs: "Deployment kuyruğa alındı...\n",
              url: `https://${project.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}.vercel-clone.app`,
            },
          });

          // Activity log ekle
          await db.activity.create({
            data: {
              userId: project.userId,
              projectId: project.id,
              type: "deployment",
              metadata: {
                deploymentId: deployment.id,
                trigger: "github_push",
                branch,
                commit,
              },
            },
          });

          // Build queue'ya ekle
          const job = await addBuildJob({
            deploymentId: deployment.id,
            projectId: project.id,
            userId: project.userId,
            repoUrl: project.repoUrl!,
            branch,
            commit,
            framework: project.framework,
            buildCommand: project.buildCommand || undefined,
            installCommand: project.installCommand || undefined,
            outputDirectory: project.outputDirectory || undefined,
            nodeVersion: project.nodeVersion || undefined,
          });

          console.log(`Build job oluşturuldu: ${job.id} - Deployment: ${deployment.id}`);

          return NextResponse.json({
            message: "Deployment başlatıldı",
            deploymentId: deployment.id,
            jobId: job.id,
          });
        }
        break;

      case "pull_request":
        // PR event'i - preview deployment oluştur
        if (payload.action === "opened" || payload.action === "synchronize") {
          const prNumber = payload.pull_request?.number;
          const prBranch = payload.pull_request?.head?.ref;
          const prCommit = payload.pull_request?.head?.sha;
          const prTitle = payload.pull_request?.title;

          // Preview deployment oluştur
          const deployment = await db.deployment.create({
            data: {
              projectId: project.id,
              status: "PENDING",
              commit: prCommit,
              commitMessage: prTitle,
              branch: `pr-${prNumber}`,
              isPreview: true,
              buildLogs: `Preview deployment for PR #${prNumber} kuyruğa alındı...\n`,
            },
          });

          // PR'a pending comment at
          await createDeploymentComment(deployment.id, "pending");

          // Build queue'ya ekle
          const job = await addBuildJob({
            deploymentId: deployment.id,
            projectId: project.id,
            userId: project.userId,
            repoUrl: project.repoUrl!,
            branch: prBranch,
            commit: prCommit,
            framework: project.framework,
            buildCommand: project.buildCommand || undefined,
            installCommand: project.installCommand || undefined,
            outputDirectory: project.outputDirectory || undefined,
            nodeVersion: project.nodeVersion || undefined,
          });

          return NextResponse.json({
            message: "Preview deployment başlatıldı",
            deploymentId: deployment.id,
            jobId: job.id,
          });
        } else if (payload.action === "closed") {
          // PR kapatıldığında preview deployment'ları temizle
          const prNumber = payload.pull_request?.number;
          const prBranch = `pr-${prNumber}`;
          
          await cleanupPreviewDeployment(project.id, prBranch);
          
          return NextResponse.json({
            message: "Preview deployment'lar temizlendi",
          });
        }
        break;

      default:
        return NextResponse.json({
          message: `${event} event'i alındı ama işlenmedi`,
        });
    }

    return NextResponse.json({ message: "Webhook işlendi" });
  } catch (error) {
    console.error("[GITHUB_WEBHOOK_HATASI]", error);
    return NextResponse.json(
      { error: "Webhook işlenirken bir hata oluştu" },
      { status: 500 }
    );
  }
} 