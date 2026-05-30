FROM node:20-alpine

# 使用国内 npm 镜像
RUN npm config set registry https://registry.npmmirror.com

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 3000
