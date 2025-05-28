'use server';

import { Octokit } from "@octokit/rest";
import { db } from "@/lib/db";

export async function createDeploymentComment(
  deploymentId: string,
  status: "pending" | "building" | "ready" | "failed"
) {
  try {
    // Deployment bilgilerini al
    const deployment = await db.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        project: {
          include: {
            user: {
              include: {
                accounts: {
                  where: { provider: "github" }
                }
              }
            }
          }
        }
      }
    });

    if (!deployment || !deployment.project.repoUrl || !deployment.isPreview) {
      return;
    }

    // GitHub token'ı al
    const githubAccount = deployment.project.user.accounts.find(
      acc => acc.provider === "github"
    );

    if (!githubAccount?.access_token) {
      console.log("GitHub access token bulunamadı");
      return;
    }

    // Repository bilgilerini parse et
    const repoMatch = deployment.project.repoUrl.match(
      /github\.com[/:]([\w-]+)\/([\w-]+)/
    );
    
    if (!repoMatch) {
      console.log("Repository URL parse edilemedi");
      return;
    }

    const [, owner, repo] = repoMatch;
    
    // PR numarasını commit'ten bul
    const octokit = new Octokit({
      auth: githubAccount.access_token,
    });

    // Commit'e ait PR'ları bul
    const { data: prs } = await octokit.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: deployment.commit!,
    });

    if (prs.length === 0) {
      console.log("Bu commit için PR bulunamadı");
      return;
    }

    const pr = prs[0];
    
    // Comment içeriğini oluştur
    const commentBody = generateCommentBody(deployment, status);

    // Mevcut comment'i bul veya yeni oluştur
    const { data: comments } = await octokit.issues.listComments({
      owner,
      repo,
      issue_number: pr.number,
    });

    const botComment = comments.find(
      (comment: any) => comment.body?.includes("<!-- vercel-clone-deployment -->")
    );

    if (botComment) {
      // Mevcut comment'i güncelle
      await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: botComment.id,
        body: commentBody,
      });
    } else {
      // Yeni comment oluştur
      await octokit.issues.createComment({
        owner,
        repo,
        issue_number: pr.number,
        body: commentBody,
      });
    }

    console.log(`PR #${pr.number} için deployment comment ${botComment ? 'güncellendi' : 'oluşturuldu'}`);
  } catch (error) {
    console.error("PR comment oluşturma hatası:", error);
  }
}

function generateCommentBody(deployment: any, status: string): string {
  const statusEmoji = {
    pending: "⏳",
    building: "🔨",
    ready: "✅",
    failed: "❌"
  }[status];

  const statusText = {
    pending: "Deployment bekleniyor",
    building: "Build ediliyor",
    ready: "Deployment hazır",
    failed: "Deployment başarısız"
  }[status];

  let body = `<!-- vercel-clone-deployment -->
### ${statusEmoji} Vercel Clone Preview Deployment

**Status:** ${statusText}
**Deployment ID:** \`${deployment.id}\`
`;

  if (status === "ready" && deployment.url) {
    body += `
**Preview URL:** ${deployment.url}

🔍 [Preview'i Görüntüle](${deployment.url})
`;
  }

  if (status === "building") {
    body += `
Build loglarını takip etmek için [buraya tıklayın](/dashboard/deployments/${deployment.id}).
`;
  }

  if (status === "failed") {
    body += `
❌ Build başarısız oldu. Detaylar için [build loglarını](/dashboard/deployments/${deployment.id}) kontrol edin.
`;
  }

  body += `
---
<sub>🚀 [Vercel Clone](/) ile deploy edildi</sub>`;

  return body;
}

// Preview deployment'ı temizle
export async function cleanupPreviewDeployment(projectId: string, branch: string) {
  try {
    // Branch'e ait preview deployment'ları bul
    const deployments = await db.deployment.findMany({
      where: {
        projectId,
        branch,
        isPreview: true,
        status: "READY"
      }
    });

    // Container'ları durdur
    const { stopDeploymentContainer } = await import("../deployment-service");
    
    for (const deployment of deployments) {
      await stopDeploymentContainer(deployment.id);
      
      // Deployment durumunu güncelle
      await db.deployment.update({
        where: { id: deployment.id },
        data: { status: "CANCELLED" }
      });
    }

    console.log(`${deployments.length} preview deployment temizlendi`);
  } catch (error) {
    console.error("Preview deployment temizleme hatası:", error);
  }
} 