# Use Node.js 20 (exigido por @nestjs/cli e @nestjs/core)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files (apenas npm - não copiar yarn.lock para evitar conflito)
COPY package.json package-lock.json ./

# Install dependencies sem rodar postinstall (prisma generate roda depois, quando prisma/ existir)
RUN npm ci --ignore-scripts

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
