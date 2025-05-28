"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  html_url: string;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

export default function ImportProjectPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<GitHubRepo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  useEffect(() => {
    fetchGitHubRepos();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = repos.filter(repo => 
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (repo.description && repo.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
      setFilteredRepos(filtered);
    } else {
      setFilteredRepos(repos);
    }
  }, [searchQuery, repos]);

  const fetchGitHubRepos = async () => {
    try {
      const response = await fetch("/api/github/repos");
      
      if (!response.ok) {
        if (response.status === 401) {
          // GitHub ile giriş yapılmamış
          router.push("/login?error=GitHub ile giriş yapmanız gerekiyor");
          return;
        }
        throw new Error("Repository'ler yüklenirken bir hata oluştu");
      }

      const data = await response.json();
      setRepos(data.repos);
      setFilteredRepos(data.repos);
    } catch (error) {
      console.error("GitHub repos hatası:", error);
      setError(error instanceof Error ? error.message : "Bir hata oluştu");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedRepo) return;

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: selectedRepo.name,
          description: selectedRepo.description || "",
          framework: detectFramework(selectedRepo),
          repoUrl: selectedRepo.html_url,
          gitProvider: "github",
          gitBranch: selectedRepo.default_branch,
          publicRepo: !selectedRepo.private,
        }),
      });

      if (!response.ok) {
        throw new Error("Proje oluşturulurken bir hata oluştu");
      }

      const data = await response.json();
      router.push(`/dashboard/projects/${data.project.id}`);
    } catch (error) {
      console.error("Import hatası:", error);
      setError(error instanceof Error ? error.message : "Import sırasında bir hata oluştu");
    }
  };

  const detectFramework = (repo: GitHubRepo): string => {
    const language = repo.language?.toLowerCase();
    
    // Basit framework tespiti - gerçek uygulamada package.json'a bakılmalı
    if (language === "javascript" || language === "typescript") {
      return "next"; // Varsayılan olarak Next.js
    } else if (language === "vue") {
      return "vue";
    } else if (language === "python") {
      return "python";
    }
    
    return "next";
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xl font-bold">
              Vercel Klonu
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-blue-500">Git'ten Import Et</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-1">Git Repository'sini Import Et</h2>
          <p className="text-gray-400">
            GitHub hesabınızdaki repository'lerden birini seçin ve projenizi oluşturun.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-md bg-red-500/20 border border-red-500 text-red-300 mb-6">
            {error}
          </div>
        )}

        <div className="mb-6">
          <Input
            type="text"
            placeholder="Repository ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-gray-800 border-gray-700"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            <p className="mt-4 text-gray-400">Repository'ler yükleniyor...</p>
          </div>
        ) : filteredRepos.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-700 rounded-lg">
            <h3 className="text-xl font-medium mb-2">Repository bulunamadı</h3>
            <p className="text-gray-400 mb-6">
              GitHub hesabınızda repository bulunmuyor veya arama kriterlerinize uygun repository yok.
            </p>
            <a
              href="https://github.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline"
            >
              GitHub'da yeni repository oluştur →
            </a>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  selectedRepo?.id === repo.id
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-800 hover:border-gray-700"
                }`}
                onClick={() => setSelectedRepo(repo)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium">{repo.name}</h3>
                      {repo.private && (
                        <span className="text-xs bg-gray-700 px-2 py-1 rounded">Private</span>
                      )}
                    </div>
                    {repo.description && (
                      <p className="text-sm text-gray-400 mb-2">{repo.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      {repo.language && (
                        <span className="flex items-center gap-1">
                          <span className="w-3 h-3 rounded-full bg-blue-500"></span>
                          {repo.language}
                        </span>
                      )}
                      <span>Branch: {repo.default_branch}</span>
                      <span>
                        Güncelleme: {new Date(repo.updated_at).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                  </div>
                  {selectedRepo?.id === repo.id && (
                    <div className="ml-4">
                      <span className="text-blue-500">✓</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-4 mt-8">
          <Button
            onClick={handleImport}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={!selectedRepo}
          >
            Import Et ve Deploy Yap
          </Button>
          <Link href="/dashboard">
            <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
              İptal
            </Button>
          </Link>
        </div>
      </main>
    </div>
  );
} 