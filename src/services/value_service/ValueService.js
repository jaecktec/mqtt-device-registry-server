const debug = require('debug')('mqtt-device-registry.ValueService');
var co = require('co');
var amqp = require('amqplib');

const ValueServiceQueue = require("./constants/ValueServiceQueue");
const AmqpExchanges = require("../../constants/AmqpExchanges");
const AmqpHelper = require("../../helper/AmqpHelper");
const MqttGatewayRoutingKey = require("../mqtt_gateway/constants/MqttGatewayRoutingKey");
const ValueServiceRoutingKey = require("./constants/ValueServiceRoutingKey");

class ValueService {

    start(amqpUrl) {
        return co.wrap(function*(_this, _amqpUrl) {

            // AMQP connect and setup
            let connection = yield amqp.connect(_amqpUrl);
            var channel = yield connection.createConfirmChannel();
            channel.prefetch(1);
            channel.assertQueue(ValueServiceQueue.mainQueue, {exclusive: false, durable: true});

            yield AmqpExchanges.createExchanges(channel);

            yield [
                channel.bindQueue(ValueServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY),
            ];

            channel.consume(ValueServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onValueMessage), {noAck: false});


        })(this, mongoUrl, amqpUrl);
    }

    stop() {
    }

    /**
     * publishes to ROUTING_KEY_VALUE_NEW
     * @param msg amqp message
     * @param channel amqp chanel
     * @returns {*} promise
     * @private
     */
    __onValueMessage(msg, channel) {
        return co.wrap(function*(_this, msg, channel) {
            debug(msg);
            channel.publish(
                AmqpExchanges.VALUE_API_EXCHANGE,
                ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW,
                AmqpHelper.objToBuffer(msg));
        })(this, msg, channel);
    }

}

module.exports = new ValueService();