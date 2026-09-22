FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000

# El seed es idempotente: crea roles/usuarios demo la primera vez y luego no hace nada.
CMD ["sh", "-c", "node src/seed.js && node src/index.js"]