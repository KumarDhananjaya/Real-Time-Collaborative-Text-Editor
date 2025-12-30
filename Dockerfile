FROM node:18-alpine

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY shared/package*.json ./shared/
COPY server/package*.json ./server/
COPY client/package*.json ./client/

# Install dependencies (including dev deps for building)
RUN npm install

# Copy source code
COPY shared ./shared
COPY server ./server

# Build shared and server
RUN npm run build:shared
RUN npm run build:server

# Expose port
EXPOSE 3001

# Start server
CMD ["npm", "run", "start", "--workspace=server"]
