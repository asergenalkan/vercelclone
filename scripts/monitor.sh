#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Vercel Clone Services Monitor${NC}"
echo "========================================"

# PM2 Status
echo -e "\n${GREEN}📊 PM2 Services Status:${NC}"
pm2 status

# Service Health Check
echo -e "\n${GREEN}🔍 Service Health Check:${NC}"

# Web service (port 3000)
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "✅ Web Service (3000): ${GREEN}HEALTHY${NC}"
else
    echo -e "❌ Web Service (3000): ${RED}DOWN${NC}"
fi

# Socket service (port 3003)
if curl -s http://localhost:3003 > /dev/null; then
    echo -e "✅ Socket Service (3003): ${GREEN}HEALTHY${NC}"
else
    echo -e "❌ Socket Service (3003): ${RED}DOWN${NC}"
fi

# Proxy service (port 3002)
if curl -s http://localhost:3002 > /dev/null; then
    echo -e "✅ Proxy Service (3002): ${GREEN}HEALTHY${NC}"
else
    echo -e "❌ Proxy Service (3002): ${RED}DOWN${NC}"
fi

# Recent logs
echo -e "\n${GREEN}📝 Recent Worker Logs (last 10 lines):${NC}"
pm2 logs vercelclone-worker --lines 10 --nostream

echo -e "\n${GREEN}📝 Recent Socket Logs (last 5 lines):${NC}"
pm2 logs vercelclone-socket --lines 5 --nostream

# System resources
echo -e "\n${GREEN}💾 System Resources:${NC}"
free -h
df -h /var/www/vercelclone

echo -e "\n${YELLOW}🔄 To continuously monitor: pm2 monit${NC}"
echo -e "${YELLOW}📊 To watch logs: pm2 logs --lines 0${NC}" 