# =====================================================================
# FINAN-X · Backend (API REST)
#
# - Sin el seed de demostración en el arranque: las cuentas se crean con
#   `npm run init:usuarios` (claves temporales + cambio obligatorio).
# - Corre como usuario `node` (no root).
# =====================================================================
FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src
COPY scripts ./scripts

ENV NODE_ENV=production
ENV PORT=4000

USER node
EXPOSE 4000

CMD ["node", "src/index.js"]
