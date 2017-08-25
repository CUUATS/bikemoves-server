FROM node:6.11-alpine

ENV POSTGRES_PORT=5432

RUN apk update && \
    apk upgrade && \
    apk add curl

WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install && npm cache clean
COPY . /usr/src/app

VOLUME /osrm
EXPOSE 8888

CMD [ "npm", "start" ]
