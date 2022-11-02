FROM node:10.15.3-alpine as builder

ARG NODE_VERSION=10.15.3

RUN mkdir /app
WORKDIR /app

ENV NODE_ENV production

COPY . .

RUN npm install --global typescript@3.8.3
RUN npm install
FROM node:10.15.3-alpine

LABEL fly_launch_runtime="nodejs"

COPY --from=builder /app /app

WORKDIR /app
ENV NODE_ENV production

# CMD [ "npm", "run", "start:prod" ]
CMD ["node", "dist/main.js"]
