FROM node:latest

RUN apt-get update && apt-get install -y graphicsmagick
RUN npm install phantomjs -g
RUN mkdir /myapp
WORKDIR /myapp
COPY . /myapp
RUN npm install
