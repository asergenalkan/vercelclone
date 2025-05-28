import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";
import { createGitHubWebhook, generateWebhookSecret, parseGitHubRepoUrl } from "@/lib/github";

const projectSchema = z.object({
  name: z.string().min(2, { message: "Proje adı en az 2 karakter olmalıdır" }),
  description: z.string().optional(),
  framework: z.string().default("next"),
  repoUrl: z.string().url({ message: "Geçerli bir URL giriniz" }).optional().or(z.literal("")),
  gitProvider: z.string().default("github"),
  gitBranch: z.string().default("main"),
  publicRepo: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const body = await req.json();
    const { name, description, framework, repoUrl, gitProvider, gitBranch, publicRepo } = projectSchema.parse(body);

    // Projeyi oluştur
    const project = await db.project.create({
      data: {
        name,
        description,
        framework,
        repoUrl,
        gitProvider,
        gitBranch: gitBranch || "main",
        publicRepo: publicRepo || false,
        userId,
      },
    });

    // GitHub webhook'u ekle (eğer GitHub repo URL'i varsa)
    if (repoUrl && gitProvider === "github") {
      try {
        const githubAccessToken = (session as any).githubAccessToken;
        
        if (githubAccessToken) {
          const repoInfo = parseGitHubRepoUrl(repoUrl);
          
          if (repoInfo) {
            const webhookSecret = generateWebhookSecret();
            const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/github`;

            // GitHub'a webhook ekle
            await createGitHubWebhook({
              repoOwner: repoInfo.owner,
              repoName: repoInfo.name,
              webhookUrl,
              secret: webhookSecret,
              accessToken: githubAccessToken,
            });

            // Webhook bilgisini veritabanına kaydet
            await db.webhook.create({
              data: {
                projectId: project.id,
                url: webhookUrl,
                events: ["push", "pull_request"],
                secret: webhookSecret,
                active: true,
              },
            });

            // Activity log ekle
            await db.activity.create({
              data: {
                userId,
                projectId: project.id,
                type: "webhook_added",
                metadata: {
                  provider: "github",
                  events: ["push", "pull_request"],
                },
              },
            });
          }
        }
      } catch (error) {
        console.error("GitHub webhook ekleme hatası:", error);
        // Webhook eklenemese bile proje oluşturulmuş olsun
      }
    }

    return NextResponse.json(
      { project, message: "Proje başarıyla oluşturuldu" },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors },
        { status: 400 }
      );
    }

    console.error("[PROJE_OLUŞTURMA_HATASI]", error);
    return NextResponse.json(
      { error: "Proje oluşturulurken bir hata oluştu" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Kullanıcının projelerini getir
    const projects = await db.project.findMany({
      where: {
        userId,
      },
      include: {
        deployments: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        domains: {
          where: {
            verified: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("[PROJE_LİSTELEME_HATASI]", error);
    return NextResponse.json(
      { error: "Projeler listelenirken bir hata oluştu" },
      { status: 500 }
    );
  }
} 