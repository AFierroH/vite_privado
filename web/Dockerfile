# Etapa 1: Construcción
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: Servidor Nginx
FROM nginx:stable-alpine

# Copiar los archivos construidos de Vue al servidor web
COPY --from=build /app/dist /usr/share/nginx/html

# Copiar la configuración personalizada (CORREGIDO .conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]