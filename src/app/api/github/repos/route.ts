import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json(
        { error: "Yetkilendirme gerekli" },
        { status: 401 }
      );
    }

    // GitHub access token'ı kontrol et
    const githubAccessToken = (session as any).githubAccessToken;
    
    if (!githubAccessToken) {
      return NextResponse.json(
        { error: "GitHub ile giriş yapmanız gerekiyor" },
        { status: 401 }
      );
    }

    // GitHub API'den repository'leri getir
    const response = await fetch("https://api.github.com/user/repos?per_page=100&sort=updated", {
      headers: {
        Authorization: `Bearer ${githubAccessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error("GitHub API hatası");
    }

    const repos = await response.json();

    // Sadece gerekli bilgileri döndür
    const simplifiedRepos = repos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      private: repo.private,
      html_url: repo.html_url,
      default_branch: repo.default_branch,
      language: repo.language,
      updated_at: repo.updated_at,
    }));

    return NextResponse.json({ repos: simplifiedRepos });
  } catch (error) {
    console.error("[GITHUB_REPOS_HATASI]", error);
    return NextResponse.json(
      { error: "Repository'ler alınırken bir hata oluştu" },
      { status: 500 }
    );
  }
} 