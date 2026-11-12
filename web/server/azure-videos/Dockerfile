# API de videos de AceCam (PCIT-224). Se construye en deploy-azure.yml.
FROM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force
COPY access.js bridge.js http.js sas.js server.js ./
USER node
EXPOSE 8080
CMD ["node", "server.js"]
