FROM node:18

WORKDIR /app

COPY package*.json ./

RUN npm install

# Copy the files over
COPY . .

RUN npm run build

ENTRYPOINT npm run start
