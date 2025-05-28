import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-black/50 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <h1 className="text-xl font-bold">Vercel Clone</h1>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="#features" className="text-gray-400 hover:text-white transition-colors">
                Özellikler
              </Link>
              <Link href="#solutions" className="text-gray-400 hover:text-white transition-colors">
                Çözümler
              </Link>
              <Link href="#pricing" className="text-gray-400 hover:text-white transition-colors">
                Fiyatlandırma
              </Link>
              <Link href="#docs" className="text-gray-400 hover:text-white transition-colors">
                Dokümantasyon
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-400 hover:text-white">
                Giriş Yap
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-white text-black hover:bg-gray-200">
                Ücretsiz Başla
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 via-transparent to-transparent"></div>
        <div className="container mx-auto max-w-6xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-gray-800/50 backdrop-blur-sm rounded-full px-4 py-2 mb-8">
            <span className="text-sm text-gray-300">Yeni</span>
            <span className="text-sm">AI destekli deployment'lar artık kullanılabilir</span>
            <span className="text-sm text-blue-500">→</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
            Web için tam teşekküllü
            <br />
            platformunuz.
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto">
            Vercel-Clone, daha hızlı ve daha kişiselleştirilmiş bir web oluşturmak, ölçeklendirmek ve güvence altına almak için geliştirici araçları ve bulut altyapısı sağlar.
          </p>
          
          <div className="flex flex-col md:flex-row gap-4 justify-center mb-16">
            <Link href="/register">
              <Button size="lg" className="bg-white text-black hover:bg-gray-200 px-8">
                Deploy Başlat
              </Button>
            </Link>
            <Link href="/demo">
              <Button size="lg" variant="outline" className="border-gray-600 text-white hover:bg-gray-800 px-8">
                Demo Al
              </Button>
            </Link>
          </div>

          {/* Terminal Animation */}
          <div className="max-w-3xl mx-auto bg-gray-900 rounded-lg border border-gray-800 p-6 text-left">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <div className="font-mono text-sm">
              <div className="text-gray-400">▲ ~ siteniz/</div>
              <div className="text-white">$ git push</div>
              <div className="text-gray-400 mt-2">Enumerating objects: 1, done.</div>
              <div className="text-gray-400">Counting objects: 100% (1/1), done.</div>
              <div className="text-gray-400">Writing objects: 100% (1/1), 72 bytes, done.</div>
              <div className="text-gray-400">Total 1 (delta 0), reused 0 (delta 0).</div>
              <div className="text-gray-400">To github.com:vercel/vercel-site.git</div>
              <div className="text-gray-400">   21326a9..81663c3 main → main</div>
              <div className="text-green-400 mt-2">✓ Production deployment ready!</div>
              <div className="text-blue-400">→ https://siteniz.pixepix.com</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
            Localhost'tan HTTPS'ye, saniyeler içinde.
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Anında Deploy</h3>
              <p className="text-gray-400">Git push ile otomatik deployment. Saniyeler içinde canlıda.</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Preview Deployments</h3>
              <p className="text-gray-400">Her PR için otomatik preview URL'leri. Ekibinizle kolayca paylaşın.</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Global Edge Network</h3>
              <p className="text-gray-400">Dünya çapında 100+ lokasyonda içeriğinizi sunun.</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-orange-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Analytics & Monitoring</h3>
              <p className="text-gray-400">Gerçek zamanlı performans metrikleri ve kullanıcı analitiği.</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-pink-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-pink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Enterprise Security</h3>
              <p className="text-gray-400">SOC 2 uyumlu, SSL sertifikaları ve DDoS koruması.</p>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 hover:border-gray-700 transition-colors">
              <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Team Collaboration</h3>
              <p className="text-gray-400">Ekibinizle gerçek zamanlı işbirliği ve yorum yapma.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Framework Support */}
      <section className="py-20 px-4 bg-gray-900/50">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Favori framework'ünüzle çalışır
          </h2>
          <p className="text-xl text-gray-400 mb-12">
            Next.js, React, Vue, Nuxt ve daha fazlası için optimize edilmiş
          </p>
          
          <div className="flex flex-wrap justify-center gap-8">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
                <span className="text-black font-bold text-xs">N</span>
              </div>
              <span>Next.js</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">R</span>
              </div>
              <span>React</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">V</span>
              </div>
              <span>Vue</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">N</span>
              </div>
              <span>Nuxt</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 bg-orange-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <span>Svelte</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-8 h-8 bg-purple-500 rounded flex items-center justify-center">
                <span className="text-white font-bold text-xs">A</span>
              </div>
              <span>Astro</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            İlk uygulamanızı saniyeler içinde deploy edin.
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Git'ten otomatik deploy • En popüler framework'ler için geniş destek • 
            Her push için preview'lar • Tüm domainleriniz için otomatik HTTPS
          </p>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <Link href="/register">
              <Button size="lg" className="bg-white text-black hover:bg-gray-200 px-8">
                Deploy Başlat
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-gray-600 text-white hover:bg-gray-800 px-8">
                Uzmanla Konuş
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-semibold mb-4">Ürünler</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white">Previews</Link></li>
                <li><Link href="#" className="hover:text-white">Edge Functions</Link></li>
                <li><Link href="#" className="hover:text-white">Analytics</Link></li>
                <li><Link href="#" className="hover:text-white">Next.js</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Kaynaklar</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white">Dokümantasyon</Link></li>
                <li><Link href="#" className="hover:text-white">Kılavuzlar</Link></li>
                <li><Link href="#" className="hover:text-white">Blog</Link></li>
                <li><Link href="#" className="hover:text-white">Şablonlar</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Şirket</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white">Hakkımızda</Link></li>
                <li><Link href="#" className="hover:text-white">Kariyer</Link></li>
                <li><Link href="#" className="hover:text-white">İletişim</Link></li>
                <li><Link href="#" className="hover:text-white">Müşteriler</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Yasal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="#" className="hover:text-white">Gizlilik</Link></li>
                <li><Link href="#" className="hover:text-white">Şartlar</Link></li>
                <li><Link href="#" className="hover:text-white">Güvenlik</Link></li>
                <li><Link href="#" className="hover:text-white">SLA</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p className="text-gray-400 text-sm">© 2024 Vercel Clone. Tüm hakları saklıdır.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <Link href="#" className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </Link>
              <Link href="#" className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"/>
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
