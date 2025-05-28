"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

interface Deployment {
  id: string;
  status: string;
  url: string | null;
  branch: string | null;
  commit: string | null;
  commitMessage: string | null;
  createdAt: string;
}

interface Domain {
  id: string;
  name: string;
  verified: boolean;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  framework: string;
  repoUrl: string | null;
  gitBranch: string;
  autoDeployEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  deployments: Deployment[];
  domains: Domain[];
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploymentLoading, setDeploymentLoading] = useState(false);

  const projectId = params.id as string;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/login");
      return;
    }

    fetchProject();
  }, [session, status, projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        if (response.status === 404) {
          router.push("/dashboard");
          return;
        }
        throw new Error("Proje yüklenemedi");
      }
      const data = await response.json();
      setProject(data);
    } catch (error) {
      console.error("Proje yükleme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNewDeployment = async () => {
    if (!project || deploymentLoading) return;

    setDeploymentLoading(true);
    try {
      const response = await fetch(`/api/projects/${project.id}/deployments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Deployment başlatılamadı");
      }

      const data = await response.json();
      
      // Yeni deployment'a yönlendir
      router.push(`/dashboard/deployments/${data.deployment.id}`);
    } catch (error) {
      console.error("Deployment hatası:", error);
      alert(error instanceof Error ? error.message : "Deployment başlatılamadı");
    } finally {
      setDeploymentLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Proje Bulunamadı</h1>
          <Link href="/dashboard">
            <Button>Dashboard'a Dön</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xl font-bold">
              Vercel Klonu
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-blue-500">{project.name}</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/api/auth/signout">
              <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
                Çıkış Yap
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold mb-1">{project.name}</h2>
            <p className="text-gray-400">{project.description || "Açıklama yok"}</p>
          </div>
          <div className="flex gap-4">
            <Button 
              onClick={handleNewDeployment}
              disabled={deploymentLoading}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {deploymentLoading ? "Başlatılıyor..." : "Yeni Deployment"}
            </Button>
            <Link href={`/dashboard/projects/${project.id}/analytics`}>
              <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
                Analytics
              </Button>
            </Link>
            <Link href={`/dashboard/projects/${project.id}/settings`}>
              <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
                Ayarlar
              </Button>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-medium mb-4">Deploymentlar</h3>
              
              {project.deployments.length === 0 ? (
                <div className="text-center p-8 border border-dashed border-gray-700 rounded-lg">
                  <h4 className="text-lg font-medium mb-2">Henüz deployment yok</h4>
                  <p className="text-gray-400 mb-6">
                    İlk deploymentınızı başlatarak projenizi yayınlayın.
                  </p>
                  <Button 
                    onClick={handleNewDeployment}
                    disabled={deploymentLoading}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {deploymentLoading ? "Başlatılıyor..." : "İlk Deploymentı Başlat"}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {project.deployments.map((deployment) => (
                    <Link 
                      key={deployment.id} 
                      href={`/dashboard/deployments/${deployment.id}`}
                      className="block"
                    >
                      <div className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors cursor-pointer">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded-full ${
                              deployment.status === "READY" 
                                ? "bg-green-500" 
                                : deployment.status === "FAILED" 
                                  ? "bg-red-500" 
                                  : deployment.status === "BUILDING"
                                    ? "bg-blue-500 animate-pulse"
                                    : "bg-yellow-500"
                            }`}></div>
                            <span className="font-medium">
                              {deployment.status === "READY" 
                                ? "Yayında" 
                                : deployment.status === "FAILED" 
                                  ? "Başarısız" 
                                  : deployment.status === "BUILDING"
                                    ? "Build Ediliyor"
                                    : "Bekliyor"}
                            </span>
                          </div>
                          <span className="text-sm text-gray-400">
                            {formatDate(new Date(deployment.createdAt))}
                          </span>
                        </div>
                        
                        {deployment.branch && (
                          <div className="text-sm text-gray-400 mb-2">
                            <span className="inline-flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                              {deployment.branch}
                            </span>
                          </div>
                        )}
                        
                        {deployment.commit && (
                          <div className="text-sm text-gray-400 mb-2">
                            <span className="font-mono bg-gray-800 px-2 py-1 rounded">
                              {deployment.commit.substring(0, 7)}
                            </span>
                            {deployment.commitMessage && (
                              <span className="ml-2">{deployment.commitMessage}</span>
                            )}
                          </div>
                        )}
                        
                        {deployment.url && (
                          <div className="mt-3">
                            <span className="text-blue-500 hover:underline text-sm inline-flex items-center gap-1">
                              {deployment.url}
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="border border-gray-800 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-medium">Domainler</h3>
                <Link href={`/dashboard/projects/${project.id}/domains/new`}>
                  <Button variant="outline" size="sm" className="border-gray-700 hover:bg-gray-800">
                    Ekle
                  </Button>
                </Link>
              </div>
              
              {project.domains.length === 0 ? (
                <div className="text-center p-6 border border-dashed border-gray-700 rounded-lg">
                  <p className="text-gray-400 text-sm">
                    Henüz domain eklenmemiş
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {project.domains.map((domain) => (
                    <div key={domain.id} className="flex items-center justify-between p-3 border border-gray-800 rounded-lg">
                      <div>
                        <div className="font-medium">{domain.name}</div>
                        <div className={`text-xs ${domain.verified ? "text-green-500" : "text-yellow-500"}`}>
                          {domain.verified ? "✓ Doğrulanmış" : "⚠ Doğrulama bekliyor"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border border-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-medium mb-4">Proje Bilgileri</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Framework:</span>
                  <span>{project.framework}</span>
                </div>
                {project.repoUrl && (
                  <div className="flex justify-between">
                    <span className="text-gray-400">Git Repository:</span>
                    <a 
                      href={project.repoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {project.repoUrl.replace(/^https?:\/\/(www\.)?/, "")}
                    </a>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-400">Branch:</span>
                  <span>{project.gitBranch}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Auto Deploy:</span>
                  <span className={project.autoDeployEnabled ? "text-green-500" : "text-gray-500"}>
                    {project.autoDeployEnabled ? "Aktif" : "Pasif"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Oluşturulma tarihi:</span>
                  <span>{formatDate(new Date(project.createdAt))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Son güncelleme:</span>
                  <span>{formatDate(new Date(project.updatedAt))}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 