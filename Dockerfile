FROM node:22-alpine AS build
WORKDIR /app

# Solo copiar paquete del servidor
COPY package.json ./package.json

RUN npm install
# Ahora copiar todo tu código web
COPY . .

RUN npm run build:web

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80