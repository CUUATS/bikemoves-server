FROM node:4-onbuild

VOLUME /var/bikemoves
ENV POSTGRES_PORT=5432
EXPOSE 8888
