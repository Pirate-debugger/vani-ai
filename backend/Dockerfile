FROM node:20-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Install frontend dependencies and build frontend
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci

COPY . .

# Generate Prisma Client
RUN cd backend && npx prisma generate

# Build Frontend
RUN cd frontend && npm run build

# Copy frontend build to backend public folder for unified serving
RUN mkdir -p backend/public && cp -r frontend/dist/* backend/public/

WORKDIR /app/backend
EXPOSE 5000

# Execute server
CMD ["node", "server.js"]
