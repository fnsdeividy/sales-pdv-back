# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files (apenas npm - não copiar yarn.lock para evitar conflito)
COPY package.json package-lock.json ./

# Install dependencies (npm ci = reproduzível e mais estável em deploy)
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma/

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "start:prod"]
