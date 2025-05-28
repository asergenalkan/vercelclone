import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { EnvVariables } from "@/components/project/env-variables";
import { ProjectSettings } from "@/components/project/project-settings";
import { DeleteProjectButton } from "@/components/project/delete-project-button";

interface ProjectSettingsPageProps {
  params: {
    id: string;
  };
}

export default async function ProjectSettingsPage({ params }: ProjectSettingsPageProps) {
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
            <span className="text-gray-400">Ayarlar</span>
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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Proje Ayarları</h1>

          {/* Tabs */}
          <div className="border-b border-gray-800 mb-8">
            <nav className="flex gap-8">
              <button className="pb-4 border-b-2 border-white font-medium">
                Genel
              </button>
              <button className="pb-4 text-gray-400 hover:text-white transition-colors">
                Domainler
              </button>
              <button className="pb-4 text-gray-400 hover:text-white transition-colors">
                Git
              </button>
              <button className="pb-4 text-gray-400 hover:text-white transition-colors">
                Fonksiyonlar
              </button>
            </nav>
          </div>

          {/* General Settings */}
          <div className="space-y-12">
            {/* Project Info */}
            <section>
              <h2 className="text-xl font-semibold mb-6">Proje Bilgileri</h2>
              <ProjectSettings project={project} />
            </section>

            {/* Environment Variables */}
            <section>
              <EnvVariables projectId={project.id} />
            </section>

            {/* Build & Development Settings */}
            <section>
              <h2 className="text-xl font-semibold mb-6">Build & Development Ayarları</h2>
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Framework</label>
                  <p className="text-gray-400">{project.framework}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Node.js Version</label>
                  <p className="text-gray-400">{project.nodeVersion || "18.x"}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Build Command</label>
                  <p className="text-gray-400 font-mono text-sm bg-black p-2 rounded">
                    {project.buildCommand || "npm run build"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Output Directory</label>
                  <p className="text-gray-400 font-mono text-sm bg-black p-2 rounded">
                    {project.outputDirectory || "Otomatik algılanır"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Install Command</label>
                  <p className="text-gray-400 font-mono text-sm bg-black p-2 rounded">
                    {project.installCommand || "npm install"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Root Directory</label>
                  <p className="text-gray-400 font-mono text-sm bg-black p-2 rounded">
                    {project.rootDirectory || "./"}
                  </p>
                </div>
              </div>
            </section>

            {/* Git Settings */}
            <section>
              <h2 className="text-xl font-semibold mb-6">Git Ayarları</h2>
              <div className="bg-gray-900 rounded-lg p-6 border border-gray-800 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Repository</label>
                  {project.repoUrl ? (
                    <a 
                      href={project.repoUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:underline"
                    >
                      {project.repoUrl}
                    </a>
                  ) : (
                    <p className="text-gray-400">Bağlı repository yok</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Production Branch</label>
                  <p className="text-gray-400">{project.gitBranch || "main"}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Auto Deploy</label>
                  <p className={project.autoDeployEnabled ? "text-green-500" : "text-gray-400"}>
                    {project.autoDeployEnabled ? "Aktif" : "Pasif"}
                  </p>
                </div>
              </div>
            </section>

            {/* Danger Zone */}
            <section>
              <h2 className="text-xl font-semibold mb-6 text-red-500">Tehlikeli Bölge</h2>
              <div className="bg-red-950/20 rounded-lg p-6 border border-red-900">
                <h3 className="font-medium mb-2">Projeyi Sil</h3>
                <p className="text-gray-400 text-sm mb-4">
                  Bu işlem geri alınamaz. Tüm deploymentlar, domainler ve ayarlar kalıcı olarak silinecektir.
                </p>
                <DeleteProjectButton 
                  projectId={project.id} 
                  projectName={project.name}
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
} 