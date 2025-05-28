import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addBuildJob } from "@/lib/queue/build-queue";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    // Projeyi kontrol et
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı" },
        { status: 404 }
      );
    }

    // User'ın GitHub access token'ını al
    let githubAccessToken = null;
    if (project.repoUrl?.includes('github.com')) {
      // Session'dan GitHub access token'ı al
      githubAccessToken = (session as any)?.githubAccessToken;
      
      // Eğer session'da yoksa, database'den al
      if (!githubAccessToken) {
        const userAccount = await db.account.findFirst({
          where: {
            userId: userId,
            provider: "github",
          },
        });
        githubAccessToken = userAccount?.access_token;
      }

      if (!githubAccessToken) {
        return NextResponse.json(
          { error: "GitHub hesabınızı bağlamanız gerekiyor. Lütfen çıkış yapıp GitHub ile tekrar giriş yapın." },
          { status: 400 }
        );
      }
    }

    // Yeni deployment oluştur
    const deployment = await db.deployment.create({
      data: {
        projectId,
        status: "PENDING",
        buildLogs: "Manual deployment kuyruğa alındı...\n",
        url: `https://${project.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now().toString(36)}.pixepix.com`,
        branch: project.gitBranch,
      },
    });

    // Eğer git repo varsa, build queue'ya ekle
    if (project.repoUrl) {
      const job = await addBuildJob({
        deploymentId: deployment.id,
        projectId: project.id,
        userId: project.userId,
        repoUrl: project.repoUrl,
        branch: project.gitBranch,
        commit: "latest", // Manual deployment için latest commit kullan
        framework: project.framework,
        buildCommand: project.buildCommand || undefined,
        installCommand: project.installCommand || undefined,
        outputDirectory: project.outputDirectory || undefined,
        nodeVersion: project.nodeVersion || undefined,
        githubAccessToken: githubAccessToken, // User'ın GitHub token'ını geç
      });

      console.log(`Manual build job oluşturuldu: ${job.id} - Deployment: ${deployment.id}`);

      // Activity log ekle
      await db.activity.create({
        data: {
          userId,
          projectId: project.id,
          type: "deployment",
          metadata: {
            deploymentId: deployment.id,
            trigger: "manual",
            jobId: job.id,
          },
        },
      });

      return NextResponse.json({
        deployment,
        jobId: job.id,
        message: "Deployment başarıyla kuyruğa alındı",
      });
    } else {
      // Git repo yoksa, demo deployment oluştur
      await db.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "READY",
          buildLogs: "Demo deployment hazır!\n",
        },
      });

      return NextResponse.json({
        deployment,
        message: "Demo deployment oluşturuldu",
      });
    }
  } catch (error) {
    console.error("[DEPLOYMENT_OLUŞTURMA_HATASI]", error);
    return NextResponse.json(
      { error: "Deployment oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const { id: projectId } = await params;
    const userId = session.user.id;

    // Projeyi kontrol et
    const project = await db.project.findUnique({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: "Proje bulunamadı" },
        { status: 404 }
      );
    }

    // Deployment'ları getir
    const deployments = await db.deployment.findMany({
      where: {
        projectId,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ deployments });
  } catch (error) {
    console.error("[DEPLOYMENT_LİSTELEME_HATASI]", error);
    return NextResponse.json(
      { error: "Deployment'lar listelenirken bir hata oluştu" },
      { status: 500 }
    );
  }
} 