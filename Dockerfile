FROM alpine:latest

RUN apk add --no-cache nodejs git

ENV MONGODB_URI     mongodb://
ENV RABBIT_MQ_URI   amqp://
ENV MQTT_URI        mqtt://
# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app
RUN git clone https://github.com/jaecktec/mqtt-device-registry-server.git /usr/src/app

# Install app dependencies
RUN npm install

CMD [ "npm", "start"]