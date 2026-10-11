# stage 1: build the React app
FROM node:24-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_URL=/api
RUN npm run build

# stage 2: compile the API
FROM node:24-slim AS backend
WORKDIR /backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# stage 3: runtime image with the compiled API and the built frontend
FROM node:24-slim
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend /backend/dist ./dist
COPY --from=frontend /frontend/dist ./public
USER node
EXPOSE 5000
CMD ["node", "dist/server.js"]
