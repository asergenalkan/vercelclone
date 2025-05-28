import crypto from "crypto";

interface CreateWebhookParams {
  repoOwner: string;
  repoName: string;
  webhookUrl: string;
  secret: string;
  accessToken: string;
}

export async function createGitHubWebhook({
  repoOwner,
  repoName,
  webhookUrl,
  secret,
  accessToken,
}: CreateWebhookParams) {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${repoOwner}/${repoName}/hooks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: "web",
          active: true,
          events: ["push", "pull_request"],
          config: {
            url: webhookUrl,
            content_type: "json",
            secret: secret,
            insecure_ssl: "0",
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Webhook oluşturulamadı");
    }

    return await response.json();
  } catch (error) {
    console.error("GitHub webhook oluşturma hatası:", error);
    throw error;
  }
}

export function generateWebhookSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function parseGitHubRepoUrl(url: string): { owner: string; name: string } | null {
  const match = url.match(/github\.com[/:]([\w-]+)\/([\w-]+)/);
  if (match) {
    return {
      owner: match[1],
      name: match[2].replace(/\.git$/, ""),
    };
  }
  return null;
} 