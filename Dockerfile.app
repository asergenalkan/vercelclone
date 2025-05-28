# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Dependencies
COPY package*.json ./
RUN npm ci

# Prisma
COPY prisma ./prisma
RUN npx prisma generate

# Source code
COPY . .

# Build
RUN npm run build

# Production stage
FROM node:18-alpine AS runner

WORKDIR /app

# System dependencies
RUN apk add --no-cache libc6-compat

# Create user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Set user
USER nextjs

# Expose port
EXPOSE 3000

# Start
ENV PORT 3000
ENV NODE_ENV production

CMD ["node", "server.js"] 