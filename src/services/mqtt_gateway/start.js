const app = require("./MqttGateway");
const assert = require("assert");

const assert = require("assert");

const RABBIT_MQ_URI = process.env.RABBIT_MQ_URI;
const MQTT_URI = process.env.MQTT_URI;

assert(RABBIT_MQ_URI, "RABBIT_MQ_URI Environment variable missing");
assert(MQTT_URI, "MQTT_URI Environment variable missing");

app.start(RABBIT_MQ_URI, MQTT_URI).catch((err) => console.error(err.stack));