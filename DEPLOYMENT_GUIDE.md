# Vercel Clone - Production Deployment Rehberi

## 🚀 Sunucu Gereksinimleri

### Minimum Sistem Gereksinimleri
- **OS**: Ubuntu 20.04 LTS veya 22.04 LTS
- **CPU**: 4 vCPU
- **RAM**: 8GB (16GB önerilir)
- **Disk**: 100GB SSD
- **Network**: Açık portlar (80, 443, 3000, 3002, 3003)

## 📋 Kurulum Adımları

### 1. Sunucuya Bağlanma ve Temel Güncelleme

```bash
# SSH ile sunucuya bağlanın
ssh root@your-server-ip

# Sistemi güncelleyin
apt update && apt upgrade -y

# Temel araçları yükleyin
apt install -y curl wget git build-essential software-properties-common
```

### 2. Docker Kurulumu

```bash
# Docker'ın resmi GPG anahtarını ekleyin
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Docker repository'sini ekleyin
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Docker'ı yükleyin
apt update
apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Docker'ı başlatın ve enable edin
systemctl start docker
systemctl enable docker

# Docker'ın çalıştığını kontrol edin
docker --version
```

### 3. Node.js Kurulumu (v18)

```bash
# NodeSource repository'sini ekleyin
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -


# Node.js'i yükleyin
apt install -y nodejs

# Versiyonu kontrol edin
node --version
npm --version
```

### 4. PostgreSQL (Neon DB) Kurulumu

Neon DB kullanıyorsanız (önerilir), bu adımı atlayabilirsiniz. Lokal PostgreSQL kullanmak isterseniz:

```bash
# PostgreSQL'i yükleyin
apt install -y postgresql postgresql-contrib

# PostgreSQL'i başlatın
systemctl start postgresql
systemctl enable postgresql

# Veritabanı ve kullanıcı oluşturun
sudo -u postgres psql << EOF
CREATE DATABASE vercelclone;
CREATE USER verceluser WITH ENCRYPTED PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE vercelclone TO verceluser;
EOF
```

### 5. Redis Kurulumu

```bash
# Redis'i yükleyin
apt install -y redis-server

# Redis konfigürasyonunu düzenleyin
sed -i 's/supervised no/supervised systemd/g' /etc/redis/redis.conf

# Redis'i başlatın
systemctl restart redis
systemctl enable redis

# Redis'in çalıştığını kontrol edin
redis-cli ping
```

### 6. Nginx Kurulumu ve Konfigürasyonu

```bash
# Nginx'i yükleyin
apt install -y nginx

# Nginx'i başlatın
systemctl start nginx
systemctl enable nginx
```

### 7. Proje Dosyalarını Klonlama

```bash
# Proje dizini oluşturun
mkdir -p /var/www
cd /var/www

# Projeyi klonlayın
git clone https://github.com/yourusername/vercelclone.git
cd vercelclone

# Dependency'leri yükleyin
npm install

# Prisma'yı generate edin
npx prisma generate
```

### 8. Environment Variables Ayarlama

```bash
# .env dosyası oluşturun
nano /var/www/vercelclone/.env
```

Aşağıdaki içeriği ekleyin:

```env
# Database (Neon DB kullanıyorsanız)
DATABASE_URL="postgresql://user:password@host:5432/database?sslmode=require"

# NextAuth
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="generate-a-secure-secret-key"

# GitHub OAuth
GITHUB_ID="your-github-oauth-app-id"
GITHUB_SECRET="your-github-oauth-app-secret"

# Redis
REDIS_HOST="localhost"
REDIS_PORT="6379"

# Build Settings
BUILDS_DIR="/var/www/vercelclone/builds"

# Encryption
ENV_ENCRYPTION_KEY="generate-a-secure-encryption-key"

# Node Environment
NODE_ENV="production"
```

### 9. Build Dizini Oluşturma

```bash
# Build dizini oluşturun
mkdir -p /var/www/vercelclone/builds
chmod 755 /var/www/vercelclone/builds
```

### 10. PM2 ile Process Management

```bash
# PM2'yi global olarak yükleyin
npm install -g pm2

# PM2 ecosystem dosyası oluşturun
nano /var/www/vercelclone/ecosystem.config.js
```

```javascript
module.exports = {
  apps: [
    {
      name: 'vercelclone-web',
      script: 'node',
      args: '.next/standalone/server.js',
      cwd: '/var/www/vercelclone',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    },
    {
      name: 'vercelclone-worker',
      script: 'npm',
      args: 'run worker',
      cwd: '/var/www/vercelclone',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'vercelclone-socket',
      script: 'npm',
      args: 'run socket',
      cwd: '/var/www/vercelclone',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      }
    },
    {
      name: 'vercelclone-proxy',
      script: 'npm',
      args: 'run proxy',
      cwd: '/var/www/vercelclone',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      }
    }
  ]
};
```

### 11. Next.js Production Build

```bash
cd /var/www/vercelclone

# Production build oluşturun
npm run build

# Veritabanı migration'larını çalıştırın
npx prisma db push
```

### 12. PM2 ile Servisleri Başlatma

```bash
# PM2 ile tüm servisleri başlatın
pm2 start ecosystem.config.js

# PM2'yi sistem başlangıcında otomatik başlat
pm2 startup systemd
pm2 save

# Servislerin durumunu kontrol edin
pm2 status
```

### 13. Nginx Reverse Proxy Konfigürasyonu

```bash
# Nginx site konfigürasyonu oluşturun
nano /etc/nginx/sites-available/vercelclone
```

```nginx
# Ana uygulama için
server {
    listen 80;
    server_name pixepix.com www.pixepix.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.io için
    location /socket.io/ {
        proxy_pass http://localhost:3003;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Wildcard subdomain için (deployment'lar)
server {
    listen 80;
    server_name *.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

ssl_certificate /etc/letsencrypt/live/pixepix.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/pixepix.com/privkey.pem;
```

```bash
# Konfigürasyonu aktif edin
ln -s /etc/nginx/sites-available/vercelclone /etc/nginx/sites-enabled/

# Default site'ı devre dışı bırakın
rm /etc/nginx/sites-enabled/default

# Nginx konfigürasyonunu test edin
nginx -t

# Nginx'i yeniden başlatın
systemctl restart nginx
```

### 14. Domain DNS Ayarları

Domain sağlayıcınızın DNS yönetim panelinde:

```
# A Kayıtları
@    A    your-server-ip
www  A    your-server-ip
*    A    your-server-ip  # Wildcard subdomain için
```

### 15. SSL Sertifikası (Let's Encrypt)

```bash
# Certbot'u yükleyin
apt install -y certbot python3-certbot-nginx

# SSL sertifikası alın
certbot --nginx -d yourdomain.com -d www.yourdomain.com -d *.yourdomain.com

# Otomatik yenileme için cron job ekleyin
echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
```

### 16. Firewall Ayarları

```bash
# UFW'yi yükleyin ve yapılandırın
apt install -y ufw

# Temel kuralları ekleyin
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Next.js (isteğe bağlı, Nginx kullanıyorsanız gerek yok)
ufw allow 3002/tcp  # Proxy (isteğe bağlı)
ufw allow 3003/tcp  # Socket.io (isteğe bağlı)

# Firewall'ı aktif edin
ufw --force enable
```

### 17. Monitoring ve Logging

```bash
# PM2 monitoring dashboard
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# Sistem monitoring için htop
apt install -y htop

# Log dosyalarını kontrol etmek için
pm2 logs
```

### 18. Backup Stratejisi

```bash
# Backup script oluşturun
nano /root/backup.sh
```

```bash
#!/bin/bash
# Veritabanı backup (Neon DB kullanıyorsanız otomatik backup vardır)
# pg_dump vercelclone > /backup/db_$(date +%Y%m%d).sql

# Dosya backup
tar -czf /backup/files_$(date +%Y%m%d).tar.gz /var/www/vercelclone

# Eski backup'ları temizle (30 günden eski)
find /backup -type f -mtime +30 -delete
```

```bash
# Script'i çalıştırılabilir yapın
chmod +x /root/backup.sh

# Cron job ekleyin (günlük backup)
echo "0 2 * * * /root/backup.sh" | crontab -
```

### 19. GitHub OAuth Güncelleme

GitHub OAuth App ayarlarınızı güncelleyin:
- Homepage URL: https://yourdomain.com
- Authorization callback URL: https://yourdomain.com/api/auth/callback/github

### 20. Final Kontroller

```bash
# Tüm servislerin çalıştığını kontrol edin
pm2 status

# Nginx durumunu kontrol edin
systemctl status nginx

# Docker durumunu kontrol edin
systemctl status docker

# Redis durumunu kontrol edin
redis-cli ping

# Logları kontrol edin
pm2 logs --lines 50
```

## 🔧 Troubleshooting

### Port Çakışmaları
```bash
# Kullanılan portları kontrol edin
netstat -tulpn | grep LISTEN
```

### PM2 Process Restart
```bash
# Tek bir process'i restart edin
pm2 restart vercelclone-web

# Tüm process'leri restart edin
pm2 restart all
```

### Nginx Hataları
```bash
# Error loglarını kontrol edin
tail -f /var/log/nginx/error.log
```

### Docker İzin Hataları
```bash
# Docker grubuna kullanıcı ekleyin
usermod -aG docker $USER
```

## 🎉 Tamamlandı!

Artık Vercel Clone platformunuz production'da çalışıyor olmalı. https://yourdomain.com adresinden erişebilirsiniz.

### Önemli Notlar:
1. Tüm secret key'leri güvenli ve unique tutun
2. Regular backup'lar alın
3. Monitoring'i aktif tutun
4. Security update'leri düzenli yapın
5. SSL sertifikalarının otomatik yenilendiğinden emin olun

## 🚀 Performans Optimizasyonları

### 1. Nginx Gzip Compression
```bash
nano /etc/nginx/nginx.conf
```

http bloğuna ekleyin:
```nginx
gzip on;
gzip_vary on;
gzip_min_length 10240;
gzip_proxied expired no-cache no-store private auth;
gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml application/javascript application/json;
gzip_disable "MSIE [1-6]\.";
```

### 2. PM2 Cluster Mode
```javascript
// ecosystem.config.js güncelleme
{
  name: 'vercelclone-web',
  script: 'node',
  args: '.next/standalone/server.js',
  cwd: '/var/www/vercelclone',
  instances: 'max', // CPU çekirdek sayısı kadar instance
  exec_mode: 'cluster',
  env: {
    NODE_ENV: 'production',
    PORT: 3000
  }
}
```

### 3. Redis Optimizasyonu
```bash
nano /etc/redis/redis.conf
```

Ekleyin:
```
maxmemory 2gb
maxmemory-policy allkeys-lru
```

### 4. Docker Cleanup Cron
```bash
# Docker temizlik script'i
nano /root/docker-cleanup.sh
```

```bash
#!/bin/bash
# Kullanılmayan container'ları temizle
docker container prune -f

# Kullanılmayan image'ları temizle
docker image prune -a -f

# Kullanılmayan volume'ları temizle
docker volume prune -f

# Build cache'i temizle
docker builder prune -f
```

```bash
chmod +x /root/docker-cleanup.sh
echo "0 3 * * * /root/docker-cleanup.sh" | crontab -
```

## 🔒 Ek Güvenlik Ayarları

### 1. Fail2ban Kurulumu
```bash
apt install -y fail2ban

# SSH koruması için konfigürasyon
nano /etc/fail2ban/jail.local
```

```ini
[sshd]
enabled = true
port = 22
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

### 2. SSH Güvenliği
```bash
nano /etc/ssh/sshd_config
```

Değiştirin:
```
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
```

### 3. Nginx Rate Limiting
```nginx
# /etc/nginx/sites-available/vercelclone içine ekleyin
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    # ... mevcut proxy ayarları ...
}
```

## 📊 Monitoring Kurulumu

### 1. Netdata (Real-time Monitoring)
```bash
bash <(curl -Ss https://my-netdata.io/kickstart.sh)
```

Nginx'e ekleyin:
```nginx
location /netdata/ {
    proxy_pass http://localhost:19999/;
    auth_basic "Netdata Monitoring";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

### 2. Uptime Monitoring
```bash
# UptimeRobot veya Pingdom gibi external servisler kullanın
# Veya basit bir health check endpoint'i ekleyin
```

## 🔄 Otomatik Deployment (CI/CD)

### GitHub Actions Workflow
`.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to server
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/www/vercelclone
            git pull origin main
            npm install
            npm run build
            npx prisma db push
            pm2 restart all
```

## 📝 Deployment Checklist

- [ ] Sunucu gereksinimleri karşılandı
- [ ] Tüm yazılımlar kuruldu
- [ ] Environment variables ayarlandı
- [ ] Database bağlantısı test edildi
- [ ] GitHub OAuth güncellendi
- [ ] Domain DNS ayarları yapıldı
- [ ] SSL sertifikası alındı
- [ ] Firewall kuralları ayarlandı
- [ ] Backup stratejisi belirlendi
- [ ] Monitoring kuruldu
- [ ] Security ayarları yapıldı
- [ ] Performance optimizasyonları uygulandı
- [ ] Test deployment'ı başarılı 