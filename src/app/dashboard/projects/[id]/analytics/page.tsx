import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";

interface AnalyticsPageProps {
  params: {
    id: string;
  };
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const project = await db.project.findUnique({
    where: {
      id: params.id,
      userId: session.user.id,
    },
  });

  if (!project) {
    notFound();
  }

  // Son 30 günlük deployment istatistikleri
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const deploymentStats = await db.deployment.groupBy({
    by: ["status"],
    where: {
      projectId: project.id,
      createdAt: {
        gte: thirtyDaysAgo,
      },
    },
    _count: true,
  });

  // Build süreleri (son 10 deployment)
  const recentDeployments = await db.deployment.findMany({
    where: {
      projectId: project.id,
      status: "READY",
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Ortalama build süresi hesapla
  const buildTimes = recentDeployments.map(d => {
    const buildTime = d.updatedAt.getTime() - d.createdAt.getTime();
    return buildTime / 1000; // saniye cinsinden
  });

  const avgBuildTime = buildTimes.length > 0 
    ? buildTimes.reduce((a, b) => a + b, 0) / buildTimes.length 
    : 0;

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/dashboard" className="text-xl font-bold">
              Vercel Klonu
            </Link>
            <span className="text-gray-400">/</span>
            <Link href={`/dashboard/projects/${project.id}`} className="text-blue-500 hover:underline">
              {project.name}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-400">Analytics</span>
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
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Analytics</h1>

          {/* Özet Kartları */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-sm text-gray-400 mb-2">Toplam Deployment</h3>
              <p className="text-3xl font-bold">
                {deploymentStats.reduce((acc, stat) => acc + stat._count, 0)}
              </p>
              <p className="text-xs text-gray-500 mt-2">Son 30 gün</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-sm text-gray-400 mb-2">Başarılı Deployment</h3>
              <p className="text-3xl font-bold text-green-500">
                {deploymentStats.find(s => s.status === "READY")?._count || 0}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                %{deploymentStats.length > 0 
                  ? Math.round(((deploymentStats.find(s => s.status === "READY")?._count || 0) / 
                    deploymentStats.reduce((acc, stat) => acc + stat._count, 0)) * 100)
                  : 0
                } başarı oranı
              </p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-sm text-gray-400 mb-2">Başarısız Deployment</h3>
              <p className="text-3xl font-bold text-red-500">
                {deploymentStats.find(s => s.status === "FAILED")?._count || 0}
              </p>
              <p className="text-xs text-gray-500 mt-2">Son 30 gün</p>
            </div>

            <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
              <h3 className="text-sm text-gray-400 mb-2">Ortalama Build Süresi</h3>
              <p className="text-3xl font-bold">
                {avgBuildTime.toFixed(1)}s
              </p>
              <p className="text-xs text-gray-500 mt-2">Son 10 deployment</p>
            </div>
          </div>

          {/* Analytics Dashboard Component */}
          <AnalyticsDashboard 
            projectId={project.id} 
            deploymentStats={deploymentStats}
            buildTimes={buildTimes}
          />
        </div>
      </main>
    </div>
  );
} 