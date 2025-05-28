"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Terminal } from "@/components/deployment/terminal";
import { useDeploymentLogs } from "@/hooks/use-deployment-logs";
import { formatDate } from "@/lib/utils";

interface Deployment {
  id: string;
  status: string;
  url: string | null;
  branch: string | null;
  commit: string | null;
  commitMessage: string | null;
  createdAt: string;
  projectName: string;
  projectId: string;
}

export default function DeploymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.id as string;
  
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const { logs, status, isConnected } = useDeploymentLogs(deploymentId);

  // Deployment bilgilerini getir
  useEffect(() => {
    async function fetchDeployment() {
      try {
        const response = await fetch(`/api/deployments/${deploymentId}/status`);
        
        if (!response.ok) {
          throw new Error("Deployment bulunamadı");
        }
        
        const data = await response.json();
        setDeployment(data.deployment);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Bir hata oluştu");
      } finally {
        setLoading(false);
      }
    }

    fetchDeployment();
  }, [deploymentId]);

  // Status güncellemelerini dinle
  useEffect(() => {
    if (deployment && status !== deployment.status) {
      setDeployment(prev => prev ? { ...prev, status } : null);
    }
  }, [status, deployment]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Hata</h1>
          <p className="text-gray-400 mb-6">{error || "Deployment bulunamadı"}</p>
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
            <Link href={`/dashboard/projects/${deployment.projectId}`} className="text-blue-500 hover:underline">
              {deployment.projectName}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-400">Deployment</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Deployment Info */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">Deployment Detayları</h1>
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
              <span className="text-lg">
                {deployment.status === "READY" 
                  ? "Hazır" 
                  : deployment.status === "FAILED" 
                    ? "Başarısız" 
                    : deployment.status === "BUILDING"
                      ? "Build Ediliyor"
                      : "Bekliyor"}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">URL</p>
              {deployment.url ? (
                <a 
                  href={deployment.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline text-sm break-all"
                >
                  {deployment.url}
                </a>
              ) : (
                <p className="text-sm">-</p>
              )}
            </div>

            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">Branch</p>
              <p className="text-sm">{deployment.branch || "-"}</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">Commit</p>
              <p className="text-sm font-mono">{deployment.commit?.substring(0, 7) || "-"}</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <p className="text-sm text-gray-400 mb-1">Oluşturulma</p>
              <p className="text-sm">{formatDate(new Date(deployment.createdAt))}</p>
            </div>
          </div>

          {deployment.commitMessage && (
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 mb-8">
              <p className="text-sm text-gray-400 mb-1">Commit Mesajı</p>
              <p className="text-sm">{deployment.commitMessage}</p>
            </div>
          )}
        </div>

        {/* Build Logs Terminal */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Build Logları</h2>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}></div>
              {isConnected ? "Bağlı" : "Bağlantı kesildi"}
            </div>
          </div>
          
          <Terminal 
            logs={logs} 
            status={status || deployment.status}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Link href={`/dashboard/projects/${deployment.projectId}`}>
            <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
              Projeye Dön
            </Button>
          </Link>
          
          {deployment.status === "READY" && deployment.url && (
            <a 
              href={deployment.url} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <Button className="bg-blue-600 hover:bg-blue-700">
                Siteyi Görüntüle
              </Button>
            </a>
          )}
        </div>
      </main>
    </div>
  );
} 