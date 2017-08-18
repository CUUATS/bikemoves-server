FROM ubuntu:16.10

WORKDIR /usr/src/app

ARG NODE_ENV
ENV NODE_ENV $NODE_ENV
ENV POSTGRES_PORT=5432

ENV DEBIAN_FRONTEND noninteractive

# Install software, and alias nodejs to node
RUN apt-get update && \
  apt-get install -y curl nodejs npm && \
  update-alternatives --install /usr/bin/node node /usr/bin/nodejs 10

COPY package.json /usr/src/app/
RUN npm install && npm cache clean
COPY . /usr/src/app

VOLUME /osrm
EXPOSE 8888

CMD [ "npm", "start" ]
