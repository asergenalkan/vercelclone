import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBuildJobStatus } from "@/lib/queue/build-queue";

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

    const { id: deploymentId } = await params;

    // Deployment'ı getir
    const deployment = await db.deployment.findUnique({
      where: {
        id: deploymentId,
      },
      include: {
        project: {
          select: {
            userId: true,
            name: true,
          },
        },
      },
    });

    if (!deployment) {
      return NextResponse.json(
        { error: "Deployment bulunamadı" },
        { status: 404 }
      );
    }

    // Kullanıcı yetkisini kontrol et
    if (deployment.project.userId !== session.user.id) {
      return NextResponse.json(
        { error: "Bu deployment'a erişim yetkiniz yok" },
        { status: 403 }
      );
    }

    // Activity'den job ID'yi bul
    const activity = await db.activity.findFirst({
      where: {
        type: "deployment",
        metadata: {
          path: ["deploymentId"],
          equals: deploymentId,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let jobStatus = null;
    if (activity && activity.metadata && typeof activity.metadata === "object" && "jobId" in activity.metadata) {
      const jobId = (activity.metadata as any).jobId;
      jobStatus = await getBuildJobStatus(jobId);
    }

    return NextResponse.json({
      deployment: {
        id: deployment.id,
        status: deployment.status,
        url: deployment.url,
        branch: deployment.branch,
        commit: deployment.commit,
        commitMessage: deployment.commitMessage,
        buildLogs: deployment.buildLogs,
        createdAt: deployment.createdAt,
        projectName: deployment.project.name,
      },
      buildJob: jobStatus,
    });
  } catch (error) {
    console.error("[DEPLOYMENT_STATUS_HATASI]", error);
    return NextResponse.json(
      { error: "Deployment durumu alınırken bir hata oluştu" },
      { status: 500 }
    );
  }
} 