[![Build Status](https://travis-ci.org/jaecktec/mqtt-device-registry-server.svg?branch=master)](https://travis-ci.org/jaecktec/mqtt-device-registry-server)

Backend for [mqtt-device-registry-client](https://github.com/jaecktec/mqtt-device-registry-client)

Work in Progress.

its possible to start the services seperately (I'm trying to code the project as a microservice :) )

this project is based on four services:

- device service (npm start-device-service)
    - Env needed: MONGODB_URI and RABBIT_MQ_URI
- node service (npm start-node-service)
    - Env needed: MONGODB_URI and RABBIT_MQ_URI
- value service (npm start-value-service)
    - Env needed: RABBIT_MQ_URI
- mqtt gateway (npm start-mqtt-gateway)
    - Env needed: MQTT_URI and RABBIT_MQ_URI

to start them all together: start with npm -start

To access the data you can use an rabbitmq amqp rpc. 
There are already helpers ready, [AmqpHelper.js](https://github.com/jaecktec/mqtt-device-registry-server/blob/master/src/helper/AmqpHelper.js)

Check the test/service - rpc tests for examples how to call the api. All amqp-channels and routing keys are stored in constsnts.

