/**
 * Created by Constantin Jaeck on 19.09.2016.
 */

const DeviceService = require("./src/services/device_service/DeviceService");
const MqttGateway = require("./src/services/mqtt_gateway/MqttGateway");
const NodeService = require("./src/services/node_service/NodeService");
const ValueService = require("./src/services/value_service/ValueService");

const debug = require("debug")("mqtt-device-registry.startjs");

const assert = require("assert");

const RABBIT_MQ_URI = process.env.RABBIT_MQ_URI;
const MONGO_DB_URI = process.env.MONGODB_URI;
const MQTT_URI = process.env.MQTT_URI;

assert(RABBIT_MQ_URI, "RABBIT_MQ_URI Environment variable missing");
assert(MONGO_DB_URI, "MONGO_DB_URI Environment variable missing");
assert(MQTT_URI, "MQTT_URI Environment variable missing");

Promise.all([
    DeviceService.start(MONGO_DB_URI, RABBIT_MQ_URI),
    NodeService.start(MONGO_DB_URI, RABBIT_MQ_URI),
    ValueService.start(RABBIT_MQ_URI)
])
    .then(()=> {
        MqttGateway.start(RABBIT_MQ_URI, MQTT_URI).then(()=>debug("Started"))

    })
    .catch(console.error);