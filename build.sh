#!/bin/bash

echo "🚀 Vercel Clone Production Build Başlatılıyor..."

# Temizlik
echo "🧹 Temizlik yapılıyor..."
rm -rf .next node_modules package-lock.json

# Dependencies
echo "📦 Dependencies yükleniyor..."
npm install --production=false

# Prisma generate
echo "🔧 Prisma generate ediliyor..."
npx prisma generate

# Build
echo "🏗️ Next.js build başlatılıyor..."
NODE_ENV=production npm run build

# Standalone output kontrolü
if [ -d ".next/standalone" ]; then
  echo "✅ Standalone output başarıyla oluşturuldu!"
  
  # Gerekli dosyaları kopyala
  echo "📋 Static dosyalar kopyalanıyor..."
  cp -r public .next/standalone/
  cp -r .next/static .next/standalone/.next/
  
  echo "🎉 Build tamamlandı!"
else
  echo "❌ Standalone output bulunamadı!"
  exit 1
fi 