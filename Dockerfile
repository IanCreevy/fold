# Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve the game and Stripe checkout
FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server/index.mjs ./server/index.mjs
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.mjs"]
