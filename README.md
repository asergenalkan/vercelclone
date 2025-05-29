# Vercel Clone

Bu proje, Vercel platformunun tam fonksiyonel bir klonudur. Next.js, TypeScript, Prisma, PostgreSQL (Neon), ve Docker kullanılarak geliştirilmiştir.

## Özellikler

### ✅ Tamamlanan Özellikler

#### 1. Kimlik Doğrulama ve Yetkilendirme
- Email/şifre ile kayıt ve giriş
- GitHub OAuth entegrasyonu
- NextAuth.js ile güvenli oturum yönetimi

#### 2. Proje Yönetimi
- Proje oluşturma, güncelleme ve silme
- GitHub repository'lerini import etme
- Otomatik framework algılama (Next.js, React, Vue)
- Proje ayarları sayfası

#### 3. Deployment Sistemi
- Git tabanlı deployment'lar
- GitHub webhook entegrasyonu ile otomatik deployment
- Pull request preview deployment'ları
- Docker container oluşturma ve çalıştırma
- Build queue sistemi (Bull + Redis)
- Container proxy sistemi

#### 4. Build Pipeline
- Repository klonlama
- Dependency yükleme (npm/yarn/pnpm)
- Build komutları çalıştırma
- Dockerfile otomatik oluşturma
- Multi-stage Docker build'leri

#### 5. Gerçek Zamanlı Özellikler
- Socket.io ile build log streaming
- Deployment durumu güncellemeleri
- Terminal benzeri log görüntüleme

#### 6. Environment Variables
- Şifrelenmiş environment variable depolama
- Development, preview ve production ortamları
- CRUD işlemleri için UI
- Container'lara otomatik injection

#### 7. Domain Yönetimi
- Custom domain ekleme
- Domain doğrulama
- SSL sertifika yönetimi (planlanıyor)

#### 8. Preview Deployments
- PR'lar için otomatik preview deployment'lar
- GitHub PR comment'leri ile status güncellemeleri
- PR kapandığında otomatik cleanup
- Preview URL'leri

#### 9. Analytics Dashboard
- Deployment istatistikleri
- Build süreleri analizi
- Status dağılımı görselleştirmesi
- Deployment aktivite haritası

### 🚧 Geliştirme Aşamasındaki Özellikler

- SSL/TLS otomatik sertifika (Let's Encrypt)
- Build cache sistemi
- Team collaboration özellikleri
- Serverless functions
- Edge functions
- CLI tool

## Kurulum

### Gereksinimler

- Node.js 18+
- PostgreSQL (Neon Database önerilir)
- Redis
- Docker
- GitHub OAuth App

### Adımlar

1. Repository'yi klonlayın:
```bash
git clone https://github.com/yourusername/vercelclone.git
cd vercelclone
```

2. Dependency'leri yükleyin:
```bash
npm install
```

3. `.env` dosyası oluşturun:
```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# NextAuth
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="your-secret-key-here"

# GitHub OAuth
GITHUB_ID="your-github-oauth-app-id"
GITHUB_SECRET="your-github-oauth-app-secret"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Build Settings
BUILDS_DIR="/tmp/builds"

# Encryption
ENV_ENCRYPTION_KEY="your-encryption-key-here"
```

4. Veritabanını hazırlayın:
```bash
npx prisma generate
npx prisma db push
```

5. Redis'i başlatın:
```bash
docker-compose up -d redis
```

6. Tüm servisleri başlatın (4 ayrı terminal):

**Terminal 1 - Next.js App:**
```bash
npm run dev
```

**Terminal 2 - Build Worker:**
```bash
npm run worker
```

**Terminal 3 - Socket.io Server:**
```bash
npm run socket
```

**Terminal 4 - Proxy Server (sudo gerekli):**
```bash
sudo npm run proxy
```

## GitHub OAuth Kurulumu

1. GitHub'da yeni bir OAuth App oluşturun:
   - Settings > Developer settings > OAuth Apps > New OAuth App
   - Application name: Vercel Clone
   - Homepage URL: http://localhost:3001
   - Authorization callback URL: http://localhost:3001/api/auth/callback/github

2. Client ID ve Client Secret'ı `.env` dosyanıza ekleyin

## Kullanım

### Temel Kullanım
1. http://localhost:3001 adresine gidin
2. Yeni hesap oluşturun veya GitHub ile giriş yapın
3. Dashboard'dan yeni proje oluşturun veya GitHub'dan import edin
4. Environment variables ekleyin (Settings > Environment Variables)
5. Deploy butonuna tıklayın
6. Build loglarını gerçek zamanlı izleyin

### Preview Deployments
1. GitHub repository'nizi import edin
2. Pull request oluşturun
3. Otomatik olarak preview deployment başlar
4. PR'da deployment status comment'i görünür
5. Preview URL'den test edin
6. PR kapandığında otomatik temizlenir

### Analytics
1. Proje detay sayfasından "Analytics" butonuna tıklayın
2. Deployment metrikleri ve build süreleri görüntülenir
3. Status dağılımı ve aktivite haritası inceleyin

### Container Deployment
- Build tamamlandığında otomatik olarak Docker container oluşturulur
- Container başlatılır ve port tahsis edilir
- Proxy server üzerinden erişilebilir hale gelir
- Environment variables otomatik inject edilir

## Proje Yapısı

```
vercelclone/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── dashboard/    # Dashboard sayfaları
│   │   ├── api/          # API endpoints
│   │   └── auth/         # Authentication sayfaları
│   ├── components/       # React components
│   │   ├── ui/           # Temel UI components
│   │   ├── project/      # Proje yönetimi components
│   │   ├── analytics/    # Analytics components
│   │   └── deployment/   # Deployment components
│   ├── lib/              # Utility functions
│   │   ├── build/        # Build worker
│   │   ├── queue/        # Job queue
│   │   ├── socket/       # Socket.io server
│   │   └── github/       # GitHub API helpers
│   └── hooks/            # Custom React hooks
├── prisma/
│   └── schema.prisma     # Database schema
├── public/               # Static files
└── docker-compose.yml    # Docker services
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Kullanıcı kaydı
- `POST /api/auth/login` - Giriş
- `GET /api/auth/session` - Oturum bilgisi

### Projects
- `GET /api/projects` - Proje listesi
- `POST /api/projects` - Yeni proje
- `GET /api/projects/:id` - Proje detayı
- `PATCH /api/projects/:id` - Proje güncelleme
- `DELETE /api/projects/:id` - Proje silme

### Deployments
- `POST /api/projects/:id/deployments` - Yeni deployment
- `GET /api/deployments/:id/status` - Deployment durumu

### Environment Variables
- `GET /api/projects/:id/env` - Env variables listesi
- `POST /api/projects/:id/env` - Yeni env variable
- `PATCH /api/projects/:id/env` - Env variable güncelleme
- `DELETE /api/projects/:id/env` - Env variable silme

### Webhooks
- `POST /api/webhooks/github` - GitHub webhook handler

## Teknolojiler

- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL (Neon)
- **Authentication**: NextAuth.js
- **Queue**: Bull, Redis
- **Real-time**: Socket.io
- **Container**: Docker, Dockerode
- **Proxy**: Express, http-proxy-middleware
- **Version Control**: Git integration, GitHub API

## Özellik Detayları

### Container Deployment
- Her deployment için ayrı Docker container
- Port tahsisi ve proxy routing
- Environment variables injection
- Container lifecycle yönetimi

### Preview Deployments
- PR açıldığında otomatik deployment
- GitHub comment'leri ile status güncellemeleri
- Preview URL'leri
- PR kapandığında cleanup

### Analytics
- Deployment metrikleri
- Build süreleri analizi
- Status dağılımı
- Aktivite haritası

### Build Pipeline
- Git repository klonlama
- Dependency yükleme
- Build işlemi
- Docker image oluşturma
- Container deployment

## Lisans

MIT

## Katkıda Bulunma

Pull request'ler kabul edilir. Büyük değişiklikler için önce bir issue açın.

## Destek

Sorularınız için issue açabilir veya [email@example.com](mailto:email@example.com) adresinden iletişime geçebilirsiniz.
