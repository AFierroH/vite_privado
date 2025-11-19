FROM node:22

WORKDIR /app

COPY package*.json ./
RUN apt-get update && apt-get install -y \
    python3 \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev

RUN npm install --omit=dev

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["node", "dist/main.js"]
