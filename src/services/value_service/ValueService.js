const debug = require('debug')('mqtt-device-registry.ValueService');
var co = require('co');
var amqp = require('amqplib');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const ValueServiceQueue = require("./constants/ValueServiceQueue");
const AmqpExchanges = require("../../constants/AmqpExchanges");
const AmqpHelper = require("../../helper/AmqpHelper");
const MqttGatewayRoutingKey = require("../mqtt_gateway/constants/MqttGatewayRoutingKey");
const ValueServiceRoutingKey = require("./constants/ValueServiceRoutingKey");

const DbValue = require("./db/Value");

class ValueService {

    start(mongoUrl, amqpUrl) {
        return co.wrap(function*(_this, _mongoUrl, _amqpUrl) {

            // AMQP connect and setup
            let connection = yield amqp.connect(_amqpUrl);
            var channel = yield connection.createConfirmChannel();
            channel.prefetch(1);
            channel.assertQueue(ValueServiceQueue.mainQueue, {exclusive: false, durable: true});
            channel.assertQueue(ValueServiceQueue.newValueQueue, {exclusive: false, durable: true});


            yield [
                channel.bindQueue(ValueServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY),
                channel.bindQueue(ValueServiceQueue.newValueQueue, AmqpExchanges.VALUE_API_EXCHANGE, ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW),
            ];

            channel.consume(ValueServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onValueMessage), {noAck: false});
            channel.consume(ValueServiceQueue.newValueQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__createNewValue), {noAck: false});

            // MONGODB connect
            yield mongoose.connect(_mongoUrl);

        })(this, mongoUrl, amqpUrl);
    }

    //noinspection JSMethodCanBeStatic
    stop() {
        mongoose.connection.close();
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
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            debug(msgObj);
            channel.publish(
                AmqpExchanges.VALUE_API_EXCHANGE,
                ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW,
                new Buffer(msg.content));
        })(this, msg, channel);
    }

    /**
     * Saves Value
     * @param msg amqp message
     * @returns {*} promise
     * @private
     */
    __createNewValue(msg) {
        return co.wrap(function*(_this, msg) {
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            let newValue = new DbValue({
                nodeId: msgObj.nodeId,
                deviceId: msgObj.deviceId,
                value: msgObj.message,
                created: new Date()
            });
            yield newValue.save();
            debug("new value saved");
        })(this, msg);
    }
}

module.exports = new ValueService();