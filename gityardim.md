git add -A && git commit -m "fix: "

git push -u origin main

cd /var/www/vercelclone
git pull origin main

npm run build:prod