# Use official node image as builder
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Copy lockfiles and workspace package files
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/
COPY backend/package.json ./backend/

# Install dependencies for building (including devDependencies)
RUN npm ci

# Copy the actual source files
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build workspaces: shared first, then backend
RUN npm run build -w shared
RUN npm run build -w backend

# Production environment
FROM node:20-alpine AS runner

WORKDIR /usr/src/app
ENV NODE_ENV=production

# Copy root lockfiles/package files
COPY package.json package-lock.json ./
# Copy shared workspace package and build artifacts
COPY --from=builder /usr/src/app/shared/package.json ./shared/
COPY --from=builder /usr/src/app/shared/dist ./shared/dist
# Copy backend workspace package and build artifacts
COPY --from=builder /usr/src/app/backend/package.json ./backend/
COPY --from=builder /usr/src/app/backend/dist ./backend/dist

# Install production-only dependencies
RUN npm ci --omit=dev --ignore-scripts

# Fastify listens on PORT (injected by Railway, typically 3001)
EXPOSE 3001

CMD ["npm", "start", "-w", "backend"]
