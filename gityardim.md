git add -A && git commit -m "fix: "

git push -u origin main

cd /var/www/vercelclone
git pull origin main

npm run build:prod



pm2 logs vercel-app
pm2 logs vercel-socket
pm2 logs vercel-worker
pm2 logs vercel-proxy

pm2 delete all

# Sonra yeniden başlatın
pm2 start ecosystem.config.js
pm2 save