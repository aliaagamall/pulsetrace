FROM node:24-alpine AS dependencies

WORKDIR /app

COPY package.json package-lock.json ./
COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY services/order-service/package.json ./services/order-service/package.json
COPY services/payment-service/package.json ./services/payment-service/package.json

RUN npm ci --omit=dev --workspace=@pulsetrace/api-gateway

FROM node:24-alpine AS runtime

ENV NODE_ENV=production

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules

COPY services/api-gateway/package.json ./services/api-gateway/package.json
COPY services/api-gateway/src ./services/api-gateway/src

USER node

EXPOSE 3000

CMD ["node", "services/api-gateway/src/server.js"]
