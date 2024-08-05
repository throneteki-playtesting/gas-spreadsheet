FROM node:21

WORKDIR /app

COPY package.json package-lock.json ./

ENV NODE_ENV=production

RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "--import", "tsx", "Server/index.ts"]