FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4000

# server.js reads PORT from env (defaults to 4000) and already
# exposes GET /health for the ALB/ECS health check.
CMD ["node", "src/server.js"]
