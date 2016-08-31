const assert = require('assert');
var co = require('co');
var amqp = require('amqplib');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const NodeServiceQueue = require("./constants/DeviceServiceQueue");
const AmqpExchanges = require("../../bin/constants/AmqpExchanges");

const DbDevice = require("./db/Device");

const DEVICE_ROUTING_KEY = "dr.api.device";

const ROUTING_KEY_DEVICE_CONNECT = "dr.api.device.connect";
const ROUTING_KEY_DEVICE_UPDATE = "dr.api.device.update";

class NodeService {

    start(mongoUrl, amqpUrl) {
        return co.wrap(function*(_this, _mongoUrl, _amqpUrl) {

            // AMQP connect and setup
            let connection = yield amqp.connect(_amqpUrl);
            var channel = yield connection.createConfirmChannel();
            channel.prefetch(1);
            channel.assertQueue(NodeServiceQueue.mainQueue, {exclusive: false, durable: true});
            channel.assertQueue(NodeServiceQueue.deviceConnectedQueue, {exclusive: false, durable: true});
            channel.assertQueue(NodeServiceQueue.deviceReconnectedQueue, {exclusive: false, durable: true});


            yield [
                channel.bindQueue(NodeServiceQueue.mainQueue, AmqpExchanges.mqttGatewayExchange, DEVICE_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.deviceConnectedQueue, AmqpExchanges.mqttGatewayExchange, ROUTING_KEY_DEVICE_CONNECT),
                channel.bindQueue(NodeServiceQueue.deviceReconnectedQueue, AmqpExchanges.mqttGatewayExchange, ROUTING_KEY_DEVICE_UPDATE),
            ];

            channel.consume(NodeServiceQueue.mainQueue, (msg)=> _this.__handleMessage(msg, channel, _this.__onDeviceMessage), {noAck: false});
            channel.consume(NodeServiceQueue.deviceConnectedQueue, (msg)=> _this.__handleMessage(msg, channel, _this.__createDevice), {noAck: false});
            channel.consume(NodeServiceQueue.deviceReconnectedQueue, (msg)=> _this.__handleMessage(msg, channel, _this.__refreshDevice), {noAck: false});

            // MONGODB connect
            yield mongoose.connect(_mongoUrl);

        })(this, mongoUrl, amqpUrl);
    }

    /**
     * Handling for amqp ack handling
     * @param msg amqp message
     * @param channel amqp channel
     * @param handler method wich should be called. passing arg0: msg, arg1: channel
     * @private
     */
    __handleMessage(msg, channel, handler) {
        co(function *() {
            yield handler(msg, channel);
            channel.ack(msg);
        }).catch((error) => {
            console.log("__handleMessage - Error", error);
            channel.reject(msg, true)
        });
    }

    /**
     * checks if device exists, if not, publishes msg to exchange with routing key:
     * exists:      ROUTING_KEY_DEVICE_UPDATE
     * not exists:  ROUTING_KEY_DEVICE_CONNECT
     * @param msg amqp message
     * @param channel amqp chanel
     * @returns {*} promise
     * @private
     */
    __onDeviceMessage(msg, channel) {
        return co.wrap(function*(_this, msg, channel) {
            let msgObj = JSON.parse(msg.content.toString('ascii'));
            console.log("__onDeviceMessage", msgObj);
            // check if device exists:
            let device = yield DbDevice.findOne({nodeId: msgObj.nodeId, id: msgObj.id});
            if (!device) {
                channel.publish(
                    AmqpExchanges.mqttGatewayExchange,
                    ROUTING_KEY_DEVICE_CONNECT,
                    new Buffer(msg.content));
            } else {
                channel.publish(
                    AmqpExchanges.mqttGatewayExchange,
                    ROUTING_KEY_DEVICE_UPDATE,
                    new Buffer(msg.content));
            }
        })(this, msg, channel);
    }

    __createDevice(msg) {
        return co.wrap(function*(_this, msg) {
            let msgObj = JSON.parse(msg.content.toString('ascii'));
            console.log("__createDevice", msgObj);
            let device = yield DbDevice.findOne({nodeId: msgObj.nodeId, id: msgObj.id});
            if (!device) {
                yield new DbDevice({
                    nodeId: msgObj.nodeId,
                    id: msgObj.id,
                    sensor: msgObj.sensor,
                    unit: msgObj.unit
                }).save();
            }
        })(this, msg);
    }

    __refreshDevice(msg) {
        return co.wrap(function*(_this, msg) {
            let msgObj = JSON.parse(msg.content.toString('ascii'));
            console.log("__refreshDevice", msgObj);
            let device = yield DbDevice.findOne({nodeId: msgObj.nodeId, id: msgObj.id});
            device.sensor = msgObj.sensor;
            device.unit = msgObj.unit;
            yield device.save();
        })(this, msg);
    }
}

module.exports = new NodeService();