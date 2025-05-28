# Build Pipeline Sistemi

## Genel Bakış

Vercel Clone'un build pipeline sistemi, kullanıcıların projelerini otomatik olarak build edip deploy etmelerini sağlar. Sistem Redis/Bull Queue kullanarak asenkron job processing yapar ve Docker container'ları oluşturur.

## Mimari

```
GitHub Push/PR → Webhook → API → Bull Queue → Build Worker → Docker → Deployment
```

## Kurulum

### 1. Redis Kurulumu

Redis'i Docker ile çalıştırın:

```bash
docker-compose up -d redis
```

Veya manuel olarak:

```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

### 2. Build Worker'ı Başlatma

Development:
```bash
npm run worker:dev
```

Production:
```bash
npm run worker
```

### 3. Environment Variables

`.env` dosyanıza ekleyin:

```env
# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Build
BUILDS_DIR=/tmp/vercel-clone-builds
```

## Build Süreci

1. **Deployment Oluşturma**
   - GitHub webhook veya manual trigger
   - Deployment kaydı oluşturulur (status: PENDING)
   - Build job queue'ya eklenir

2. **Repository Klonlama**
   - Git repository klonlanır
   - Belirtilen branch checkout edilir

3. **Bağımlılıkları Yükleme**
   - `npm install` veya custom install command çalıştırılır

4. **Build İşlemi**
   - Framework'e göre build komutu çalıştırılır
   - Next.js: `npm run build`
   - React/Vue: `npm run build`

5. **Docker Image Oluşturma**
   - Framework'e uygun Dockerfile generate edilir
   - Docker image build edilir
   - Image tag: `vercel-clone/{deploymentId}:latest`

6. **Deployment Tamamlama**
   - Status: READY olarak güncellenir
   - URL atanır
   - Build logları kaydedilir

## API Endpoints

### Deployment Status
```
GET /api/deployments/{deploymentId}/status
```

Response:
```json
{
  "deployment": {
    "id": "clxx...",
    "status": "BUILDING",
    "buildLogs": "Installing dependencies...",
    "url": "https://project-name-xxx.pixepix.com"
  },
  "buildJob": {
    "id": "123",
    "state": "active",
    "progress": 50
  }
}
```

## Framework Desteği

### Next.js
- Build: `npm run build`
- Output: `.next` dizini
- Container: Node.js runtime
- Port: 3000

### React
- Build: `npm run build`
- Output: `build` dizini
- Container: Nginx static server
- Port: 80

### Vue
- Build: `npm run build`
- Output: `dist` dizini
- Container: Nginx static server
- Port: 80

## Monitoring

Bull Board UI'ı kullanarak queue'ları izleyebilirsiniz:

```bash
docker-compose up -d bull-board
```

Ardından http://localhost:3002 adresine gidin.

## Troubleshooting

### Redis Bağlantı Hatası
- Redis'in çalıştığından emin olun: `docker ps`
- Port 6379'un kullanılabilir olduğunu kontrol edin

### Build Hataları
- Build loglarını kontrol edin
- Docker daemon'ın çalıştığından emin olun
- Disk alanını kontrol edin

### Worker Çökmesi
- Worker loglarını kontrol edin
- Redis bağlantısını kontrol edin
- Memory limitlerini kontrol edin

## Gelecek İyileştirmeler

1. **Build Cache**
   - Docker layer caching
   - npm cache mounting
   - Incremental builds

2. **Paralel Builds**
   - Multiple worker instances
   - Job priority queue
   - Resource limiting

3. **Build Optimizasyonları**
   - Turbopack entegrasyonu
   - SWC compiler
   - Tree shaking

4. **Monitoring**
   - Prometheus metrics
   - Build performance tracking
   - Error alerting 