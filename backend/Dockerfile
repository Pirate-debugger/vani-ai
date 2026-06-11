FROM node:20-alpine
WORKDIR /app
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY . .
RUN cd frontend && npm run build
# Serve frontend static files from Express
RUN mkdir -p backend/public && cp -r frontend/dist/* backend/public/
WORKDIR /app/backend
EXPOSE 5000
CMD ["node", "server.js"]
