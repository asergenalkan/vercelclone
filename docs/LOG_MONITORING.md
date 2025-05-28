# 📊 Vercel Clone - Log Monitoring Kılavuzu

Bu kılavuz Vercel Clone platformundaki tüm servislerin log'larını izlemek ve sorunları teşhis etmek için kullanabileceğiniz komutları içerir.

## 🚀 Hızlı Başlangıç

### Genel Platform Durumu
```bash
# Monitoring script'ini çalıştır (önerilir)
cd /var/www/vercelclone
./scripts/monitor.sh

# PM2 servislerin durumu
pm2 status

# İnteraktif monitoring dashboard
pm2 monit
```

## 📝 PM2 Log Komutları

### Tüm Servisler
```bash
# Tüm servislerin son logları
pm2 logs

# Tüm servislerin real-time logları (sürekli takip)
pm2 logs --lines 0

# Son 50 satır log
pm2 logs --lines 50

# Raw formatında (timestamp olmadan)
pm2 logs --raw

# JSON formatında
pm2 logs --json
```

### Belirli Servisler

#### Web Service (Ana Uygulama)
```bash
# Son loglar
pm2 logs vercelclone-web --lines 20

# Real-time takip
pm2 logs vercelclone-web --lines 0

# Sadece error logları
pm2 logs vercelclone-web --err

# Sadece output logları
pm2 logs vercelclone-web --out
```

#### Build Worker (Deployment İşlemleri)
```bash
# Son build logları
pm2 logs vercelclone-worker --lines 30

# Real-time build takibi
pm2 logs vercelclone-worker --lines 0

# Build error logları
pm2 logs vercelclone-worker --err

# Build process detayları
pm2 logs vercelclone-worker --lines 100 | grep "Build"
```

#### Socket Server (Real-time Logs)
```bash
# Socket connection logları
pm2 logs vercelclone-socket --lines 20

# Real-time socket events
pm2 logs vercelclone-socket --lines 0

# Socket error logları
pm2 logs vercelclone-socket --err
```

#### Proxy Server (Deployment Routing)
```bash
# Proxy routing logları
pm2 logs vercelclone-proxy --lines 20

# Real-time proxy events
pm2 logs vercelclone-proxy --lines 0

# Proxy error logları
pm2 logs vercelclone-proxy --err
```

## 🔍 Build Log Analizi

### Build İşlem Takibi
```bash
# Son deployment build'ini takip et
pm2 logs vercelclone-worker --lines 0 | grep -E "(Build|🚀|📋|❌|✅)"

# Build hatalarını filtrele
pm2 logs vercelclone-worker --lines 100 | grep -E "(error|Error|ERROR|❌|failed)"

# Build başarılarını filtrele
pm2 logs vercelclone-worker --lines 100 | grep -E "(success|Success|✅|completed|tamamlandı)"
```

### Manual Build Debugging
```bash
# Build dizinini kontrol et
ls -la /var/www/vercelclone/builds/

# En son build dizinine git
cd /var/www/vercelclone/builds/$(ls -t /var/www/vercelclone/builds/ | head -1)

# Package.json'u kontrol et
cat package.json

# Manual build test
npm run build

# Detaylı build log
npm run build 2>&1 | tee build.log

# Build output'u kontrol et
ls -la .next/

# Standalone build kontrolü
ls -la .next/standalone/
```

## 🌐 Servis Sağlık Kontrolü

### Port Kontrolü
```bash
# Çalışan portları kontrol et
netstat -tulpn | grep -E "(3000|3002|3003)"

# Port 3000 (Web) kontrolü
curl -I http://localhost:3000

# Port 3003 (Socket) kontrolü
curl -I http://localhost:3003

# Port 3002 (Proxy) kontrolü
curl -I http://localhost:3002

# Domain üzerinden kontrol
curl -I https://pixepix.com
curl -I https://pixepix.com/socket.io/
```

### Process Kontrolü
```bash
# PM2 process durumu
pm2 list

# JSON formatında detaylı bilgi
pm2 jlist

# Memory ve CPU kullanımı
pm2 monit

# Process detayları
pm2 describe vercelclone-web
pm2 describe vercelclone-worker
pm2 describe vercelclone-socket
pm2 describe vercelclone-proxy
```

## 📊 Log Filtreleme ve Arama

### Tarih Bazlı Filtreleme
```bash
# Bugünün logları
pm2 logs --lines 1000 | grep "$(date '+%Y-%m-%d')"

# Son 1 saatin logları
pm2 logs --lines 1000 | grep "$(date '+%Y-%m-%d %H')"

# Belirli bir saatteki loglar
pm2 logs --lines 1000 | grep "2025-05-28 20:"
```

### Error Türlerine Göre Filtreleme
```bash
# JavaScript/Node.js hataları
pm2 logs --lines 500 | grep -E "(TypeError|ReferenceError|SyntaxError|Error:)"

# Network hataları
pm2 logs --lines 500 | grep -E "(ECONNREFUSED|ENOTFOUND|timeout|502|503|504)"

# Database hataları
pm2 logs --lines 500 | grep -E "(Prisma|Database|Connection|ECONNRESET)"

# Build hataları
pm2 logs vercelclone-worker --lines 500 | grep -E "(Build failed|npm ERR|error TS|ESLint)"
```

### Deployment Tracking
```bash
# Deployment process'lerini takip et
pm2 logs vercelclone-worker --lines 0 | grep -E "(Deployment:|cmb[a-z0-9]+)"

# Successful deployments
pm2 logs vercelclone-worker --lines 200 | grep -E "(Deployment tamamlandı|Container başlatılıyor)"

# Failed deployments
pm2 logs vercelclone-worker --lines 200 | grep -E "(Build hatası|Docker build başarısız)"
```

## 📁 Log Dosyası Lokasyonları

### PM2 Log Dosyaları
```bash
# PM2 log dizini
ls -la /root/.pm2/logs/

# Web service logları
tail -f /root/.pm2/logs/vercelclone-web-out.log
tail -f /root/.pm2/logs/vercelclone-web-error.log

# Worker logları
tail -f /root/.pm2/logs/vercelclone-worker-out.log
tail -f /root/.pm2/logs/vercelclone-worker-error.log

# Socket logları
tail -f /root/.pm2/logs/vercelclone-socket-out.log
tail -f /root/.pm2/logs/vercelclone-socket-error.log

# Proxy logları
tail -f /root/.pm2/logs/vercelclone-proxy-out.log
tail -f /root/.pm2/logs/vercelclone-proxy-error.log
```

### Sistem Logları
```bash
# Nginx access logları
tail -f /var/log/nginx/access.log

# Nginx error logları
tail -f /var/log/nginx/error.log

# System journal (systemctl)
journalctl -u nginx -f
journalctl -u docker -f

# Docker logları
docker logs $(docker ps -q) --follow
```

## 🔧 Log Yönetimi

### Log Temizleme
```bash
# PM2 loglarını temizle
pm2 flush

# PM2 loglarını döndür (rotate)
pm2 reloadLogs

# Eski build dizinlerini temizle
find /var/www/vercelclone/builds -type d -mtime +7 -exec rm -rf {} \;

# Docker loglarını temizle
docker system prune -f
```

### Log Boyutu Kontrolü
```bash
# PM2 log dosya boyutları
du -sh /root/.pm2/logs/*

# Build dizini boyutu
du -sh /var/www/vercelclone/builds/

# Docker images boyutu
docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
```

## 🚨 Acil Durum Komutları

### Servis Restart
```bash
# Tüm servisleri restart et
pm2 restart all

# Sadece problem olan servisi restart et
pm2 restart vercelclone-worker

# Servis durdurup yeniden başlat
pm2 stop vercelclone-worker
pm2 start vercelclone-worker
```

### Log İzleme Kombinasyonları
```bash
# Multi-service log takibi
pm2 logs vercelclone-web vercelclone-worker --lines 0

# Error-only monitoring
pm2 logs --err --lines 0

# Build process + socket events takibi
pm2 logs vercelclone-worker vercelclone-socket --lines 0 | grep -E "(Build|Socket|🚀|📋|❌|✅)"
```

## 📈 Performance Monitoring

### Resource Usage
```bash
# PM2 memory ve CPU
pm2 monit

# System resources
htop
free -h
df -h

# Network connections
netstat -an | grep :3000
netstat -an | grep :3002
netstat -an | grep :3003
```

### Real-time Monitoring Script
```bash
# Sürekli monitoring (her 5 saniyede)
watch -n 5 './scripts/monitor.sh'

# Compact monitoring
watch -n 2 'pm2 list && echo "=== Recent Errors ===" && pm2 logs --err --lines 5 --nostream'
```

## 💡 İpuçları

1. **Real-time takip için**: `pm2 logs --lines 0` kullanın
2. **Hata debugging için**: `pm2 logs --err` kullanın  
3. **Build sorunları için**: Worker loglarını detaylı inceleyin
4. **Performance sorunları için**: `pm2 monit` kullanın
5. **Genel durum için**: `./scripts/monitor.sh` çalıştırın

## 🔗 Yararlı Kombinasyonlar

```bash
# Build failure investigation
pm2 logs vercelclone-worker --lines 100 | grep -A5 -B5 "❌"

# Deployment success tracking  
pm2 logs vercelclone-worker --lines 200 | grep -E "(🎉|✅|Deployment tamamlandı)"

# Socket connection debugging
pm2 logs vercelclone-socket --lines 50 | grep -E "(Client connected|Client disconnected|Socket.io)"

# Proxy routing analysis
pm2 logs vercelclone-proxy --lines 100 | grep -E "(GET|POST|pixepix.com)"
``` 