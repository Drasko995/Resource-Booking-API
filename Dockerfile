FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV TZ=UTC
COPY package*.json tsconfig.json ./
RUN npm ci && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY src ./src
EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
