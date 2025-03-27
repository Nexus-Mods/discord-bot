FROM node:20

WORKDIR /app

COPY package*.json ./

RUN corepack enable
RUN npm install

# Copy the files over
COPY . .

RUN npm run build

ENTRYPOINT npm run start
