FROM node:18-alpine

WORKDIR /app

# Copiar archivos de configuración primero
COPY package*.json ./
COPY postcss.config.cjs ./
COPY tailwind.config.cjs ./
COPY vite.config.js ./
COPY index.html ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY src ./src
COPY generate-version.js ./

# Generate version
RUN node generate-version.js

EXPOSE 3000

CMD ["npm", "start"]
