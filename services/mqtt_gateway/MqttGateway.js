const mqtt = require("mqtt");
const assert = require('assert');
var co = require('co');
var amqp = require('amqplib');
const MqttHandler = require("./MqttHandler");

const AmqpExchanges = require("../../bin/constants/AmqpExchanges");

class MqttApp {

    constructor() {
        this.mqttHandler = new MqttHandler(
            (device) => this.__publishDevice(device),
            (node) => this.__publishNodeDisconnected(node),
            (message) => this.__publishMessage(message))
    }

    /**
     * Handles device Messages.
     * update or new device
     *
     * publishes to dr.mqtt (default)
     * routing key: dr.api.device
     *
     * @param device
     * @private
     */
    __publishDevice(device) {
        assert(this.channel);
        let amqpMessage = JSON.stringify({
            nodeId: device.id,
            id: device.device.id,
            unit: device.device.unit,
            sensor: device.device.sensor
        });
        console.log(this.exchange.exchange, "dr.api.device", amqpMessage);
        this.channel.publish(
            this.exchange.exchange,
            "dr.api.device",
            new Buffer(amqpMessage));
    }

    __publishNodeDisconnected(node) {
        assert(this.channel);
        let amqpMessage = JSON.stringify({
            nodeId: node,
        });
        console.log(this.exchange.exchange, "dr.api.node", amqpMessage);
        this.channel.publish(
            this.exchange.exchange,
            "dr.api.node",
            new Buffer(amqpMessage));
    }

    /**
     * Handles "Value" messages from the Device
     * @param message expects : {id: String, device: {id: String, message: Object}}
     * @private
     */
    __publishMessage(message) {
        assert(this.channel);
        assert(message.id);
        assert(message.device.id);
        assert(message.device.message);
        let amqpMessage = JSON.stringify({
            nodeId: message.id,
            deviceId: message.device.id,
            message: message.device.message
        });
        console.log(this.exchange.exchange, "dr.api.value", amqpMessage);
        this.channel.publish(
            this.exchange.exchange,
            "dr.api.value",
            new Buffer(amqpMessage));
    }

    start(amqpUrl, mqttUrl) {
        return co.wrap(function*(_this, _amqpUrl, _mqttUrl) {
            let connection = yield amqp.connect(_amqpUrl);
            var channel = yield connection.createChannel();
            let exchange = yield channel.assertExchange(AmqpExchanges.mqttGatewayExchange, 'direct', {durable: false});
            _this.exchange = exchange;
            _this.channel = channel;
            _this.mqttClient = mqtt.connect(_mqttUrl);
            _this.mqttClient.subscribe('dr/register/+');
            _this.mqttClient.subscribe('dr/device/+/+');
            _this.mqttClient.subscribe('dr/unregister/+');
            _this.mqttClient.on('message', (topic, message)=>_this.mqttHandler.handle(topic, message));
            _this.mqttClient.publish('dr/register/update');
            return Promise.resolve();
        })(this, amqpUrl, mqttUrl);
    }

}

module.exports = new MqttApp();