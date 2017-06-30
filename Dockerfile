FROM ubuntu:16.10

WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
ENV POSTGRES_PORT=5432

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update
RUN apt-get -qq update
RUN apt-get install -y nodejs npm

# Alias nodejs to node
RUN update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

COPY package.json /usr/src/app/
RUN npm install && npm cache clean
COPY . /usr/src/app

VOLUME /osrm
EXPOSE 8888

CMD [ "npm", "start" ]
