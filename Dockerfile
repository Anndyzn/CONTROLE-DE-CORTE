FROM node:20

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY tsconfig.json ./
COPY src ./src
COPY database.db ./database.db

EXPOSE 3000

CMD ["npm", "run", "dev"]