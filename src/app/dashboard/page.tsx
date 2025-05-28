import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const projects = await db.project.findMany({
    where: {
      userId: session.user.id,
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

  // Son deployment'ları al (Recent Previews için)
  const recentDeployments = await db.deployment.findMany({
    where: {
      project: {
        userId: session.user.id,
      },
      status: "READY",
    },
    include: {
      project: true,
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 3,
  });

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Ana Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-white text-black flex items-center justify-center text-sm font-bold">
              ▲
            </div>
            <span className="text-gray-400">/</span>
            <span className="text-sm text-gray-400">{session.user.name || session.user.email?.split('@')[0]}'s projects</span>
            <select className="bg-transparent text-sm border-none outline-none text-gray-400">
              <option>Hobby</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              Ship 🚢 tickets →
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              Feedback
            </Button>
            <div className="relative">
              <div className="w-2 h-2 bg-blue-500 rounded-full absolute -top-1 -right-1"></div>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                🔔
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
              📊
            </Button>
            <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center text-sm">
              {session.user.name?.[0] || session.user.email?.[0] || 'U'}
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex space-x-8">
            <Link href="/dashboard" className="py-4 border-b-2 border-white text-white text-sm font-medium">
              Overview
            </Link>
            <Link href="/dashboard/integrations" className="py-4 text-gray-400 hover:text-white text-sm">
              Integrations
            </Link>
            <Link href="/dashboard/deployments" className="py-4 text-gray-400 hover:text-white text-sm">
              Deployments
            </Link>
            <Link href="/dashboard/activity" className="py-4 text-gray-400 hover:text-white text-sm">
              Activity
            </Link>
            <Link href="/dashboard/domains" className="py-4 text-gray-400 hover:text-white text-sm">
              Domains
            </Link>
            <Link href="/dashboard/usage" className="py-4 text-gray-400 hover:text-white text-sm">
              Usage
            </Link>
            <Link href="/dashboard/monitoring" className="py-4 text-gray-400 hover:text-white text-sm">
              Monitoring
            </Link>
            <Link href="/dashboard/storage" className="py-4 text-gray-400 hover:text-white text-sm">
              Storage
            </Link>
            <Link href="/dashboard/settings" className="py-4 text-gray-400 hover:text-white text-sm">
              Settings
            </Link>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {/* Search ve Controls */}
        <div className="flex flex-col lg:flex-row gap-6 mb-8">
          <div className="flex-1">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <Input 
                placeholder="Search Repositories and Projects..." 
                className="pl-10 bg-gray-900 border-gray-700 text-white placeholder-gray-400 focus:border-gray-600"
              />
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                ⌘ K
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <select className="bg-gray-900 border border-gray-700 rounded-md px-3 py-2 text-sm text-white">
              <option>Sort by activity</option>
              <option>Sort by name</option>
              <option>Sort by created</option>
              <option>Sort by updated</option>
            </select>
            <div className="flex border border-gray-700 rounded-md">
              <Button variant="ghost" size="sm" className="border-r border-gray-700 text-gray-400 hover:text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/>
                </svg>
              </Button>
              <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z"/>
                </svg>
              </Button>
            </div>
            <div className="relative">
              <Button className="bg-white text-black hover:bg-gray-200">
                Add New...
                <svg className="w-4 h-4 ml-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
              </Button>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Previews */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-medium mb-4">Recent Previews</h3>
            <div className="space-y-3">
              {recentDeployments.length > 0 ? (
                recentDeployments.map((deployment) => (
                  <Link 
                    key={deployment.id}
                    href={`/dashboard/deployments/${deployment.id}`}
                    className="block border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-xs">
                        ▲
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {deployment.project.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          <span>Preview</span>
                          <span>Source</span>
                          <span className="bg-green-900 text-green-300 px-1 rounded">
                            {deployment.commit?.substring(0, 7) || 'latest'}
                          </span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" className="text-gray-400">
                        ⋯
                      </Button>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-sm">Henüz preview deployment yok</p>
                </div>
              )}
            </div>
          </div>

          {/* Projects */}
          <div className="lg:col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-medium">Projects</h3>
              <div className="flex gap-2">
                <Link href="/dashboard/projects/import">
                  <Button variant="outline" className="border-gray-700 hover:bg-gray-800 text-sm">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    Import Git Repository
                  </Button>
                </Link>
              </div>
            </div>

            {projects.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-gray-700 rounded-lg">
                <h3 className="text-xl font-medium mb-2">Henüz projeniz yok</h3>
                <p className="text-gray-400 mb-6">
                  İlk projenizi oluşturarak başlayın veya GitHub'dan import edin.
                </p>
                <div className="flex gap-4 justify-center">
                  <Link href="/dashboard/projects/import">
                    <Button variant="outline" className="border-gray-700 hover:bg-gray-800">
                      <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                      </svg>
                      GitHub'dan Import Et
                    </Button>
                  </Link>
                  <Link href="/dashboard/projects/new">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      İlk Projeni Oluştur
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((project) => {
                  const latestDeployment = project.deployments[0];
                  return (
                    <Link 
                      key={project.id} 
                      href={`/dashboard/projects/${project.id}`}
                      className="block"
                    >
                      <div className="border border-gray-800 rounded-lg p-6 transition-all hover:border-gray-700 hover:bg-gray-900">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white text-black rounded flex items-center justify-center text-sm font-bold">
                              ▲
                            </div>
                            <div>
                              <h3 className="text-lg font-medium mb-1">{project.name}</h3>
                              <p className="text-gray-400 text-sm mb-2">
                                {project.description || "Açıklama yok"}
                              </p>
                              
                              {project.repoUrl && (
                                <div className="flex items-center gap-2 text-sm text-gray-400">
                                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                                  </svg>
                                  <span>{project.repoUrl.split('/').slice(-2).join('/')}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-4 text-sm text-gray-500 mt-2">
                                <span>Initial commit Created from https://vercel.com/new</span>
                                <span>{formatDate(project.createdAt)} on</span>
                                <span className="bg-gray-800 px-2 py-1 rounded text-xs">
                                  {project.gitBranch || 'main'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {latestDeployment && (
                              <div className={`text-sm px-2 py-1 rounded ${
                                latestDeployment.status === "READY" 
                                  ? "text-green-400 bg-green-900/20" 
                                  : latestDeployment.status === "FAILED" 
                                    ? "text-red-400 bg-red-900/20" 
                                    : "text-yellow-400 bg-yellow-900/20"
                              }`}>
                                {latestDeployment.status === "READY" 
                                  ? "✓ Ready" 
                                  : latestDeployment.status === "FAILED" 
                                    ? "✗ Failed" 
                                    : "⟳ Building"}
                              </div>
                            )}
                            
                            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                              </svg>
                            </Button>
                          </div>
                        </div>
                        
                        {project.domains.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-800">
                            <div className="text-sm text-gray-400">
                              Production: <span className="text-white">{project.domains[0].name}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
                
                {/* Connect Git Repository Card */}
                <div className="border border-dashed border-gray-700 rounded-lg p-6 text-center">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-gray-700 rounded flex items-center justify-center text-sm">
                      ▲
                    </div>
                    <div>
                      <h3 className="text-lg font-medium">Connect Git Repository</h3>
                      <p className="text-gray-400 text-sm">2d ago</p>
                    </div>
                  </div>
                  <Link href="/dashboard/projects/import">
                    <Button className="bg-blue-600 hover:bg-blue-700">
                      Connect Git Repository
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
} 