FROM node:6.11.2-stretch

ENV POSTGRES_PORT=5432

RUN apt-get update && \
    apt-get install -y curl

WORKDIR /usr/src/app

COPY package.json /usr/src/app/
RUN npm install && npm cache clean
COPY . /usr/src/app

VOLUME /osrm
EXPOSE 8888

CMD [ "npm", "start" ]
