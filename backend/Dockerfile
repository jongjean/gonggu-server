FROM node:20-alpine

RUN apk add --no-cache curl
ENV NODE_ENV=production
WORKDIR /app

# 1) 우선 package.json만 복사하고 install (lock 없으면 npm install로 생성)
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

# 2) 나머지 소스 + Prisma 스키마 복사
COPY . .

# 3) 이제 스키마가 있으므로 Client 생성
RUN npx prisma generate

EXPOSE 3000
CMD ["node", "server.js"]
