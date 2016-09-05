const debug = require('debug')('mqtt-device-registry.test.DeviceService');
var co = require('co');
var amqp = require('amqplib');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const DeviceServiceQueue = require("./constants/DeviceServiceQueue");
const AmqpExchanges = require("../../constants/AmqpExchanges");
const AmqpHelper = require("../../helper/AmqpHelper");
const MqttGatewayRoutingKey = require("../mqtt_gateway/constants/MqttGatewayRoutingKey");
const DeviceServiceRoutingKey = require("./constants/DeviceServiceRoutingKey");

const DbDevice = require("./db/Device");

class DeviceService {

    start(mongoUrl, amqpUrl) {
        return co.wrap(function*(_this, _mongoUrl, _amqpUrl) {

            // AMQP connect and setup
            let connection = yield amqp.connect(_amqpUrl);
            var channel = yield connection.createConfirmChannel();
            channel.prefetch(1);
            channel.assertQueue(DeviceServiceQueue.mainQueue, {exclusive: false, durable: true});
            channel.assertQueue(DeviceServiceQueue.deviceConnectedQueue, {exclusive: false, durable: true});
            channel.assertQueue(DeviceServiceQueue.deviceReconnectedQueue, {exclusive: false, durable: true});


            yield [
                channel.bindQueue(DeviceServiceQueue.mainQueue, AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY),
                channel.bindQueue(DeviceServiceQueue.deviceConnectedQueue, AmqpExchanges.mqttGatewayExchange, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT),
                channel.bindQueue(DeviceServiceQueue.deviceReconnectedQueue, AmqpExchanges.mqttGatewayExchange, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE),
            ];

            channel.consume(DeviceServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onDeviceMessage), {noAck: false});
            channel.consume(DeviceServiceQueue.deviceConnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__createDevice), {noAck: false});
            channel.consume(DeviceServiceQueue.deviceReconnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__refreshDevice), {noAck: false});

            // MONGODB connect
            yield mongoose.connect(_mongoUrl);

        })(this, mongoUrl, amqpUrl);
    }

    // /**
    //  * Handling for amqp ack handling
    //  * @param msg amqp message
    //  * @param channel amqp channel
    //  * @param handler method wich should be called. passing arg0: msg, arg1: channel
    //  * @private
    //  */
    // __handleMessage(msg, channel, handler) {
    //     co(function *() {
    //         yield handler(msg, channel);
    //         channel.ack(msg);
    //     }).catch((error) => {
    //         console.log("__handleMessage - Error", error);
    //         channel.reject(msg, true)
    //     });
    // }

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
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            // check if device exists:
            let device = yield DbDevice.findOne({nodeId: msgObj.nodeId, id: msgObj.id});
            if (!device) {
                channel.publish(
                    AmqpExchanges.mqttGatewayExchange,
                    DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT,
                    new Buffer(msg.content));
            } else {
                channel.publish(
                    AmqpExchanges.mqttGatewayExchange,
                    DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE,
                    new Buffer(msg.content));
            }
        })(this, msg, channel);
    }

    /**
     * Creates a new Device
     * @param msg amqp message
     * @returns {*} promise
     * @private
     */
    __createDevice(msg) {
        return co.wrap(function*(_this, msg) {
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            let device = yield DbDevice.findOne({nodeId: msgObj.nodeId, id: msgObj.id});
            if (!device) {
                let newDevice = new DbDevice({
                    nodeId: msgObj.nodeId,
                    id: msgObj.id,
                    sensor: msgObj.sensor,
                    unit: msgObj.unit
                });
                yield newDevice.save();
                debug("New Device saved");
            }
        })(this, msg);
    }

    /**
     * Updates existing device
     * @param msg amqp message
     * @returns {*} promise
     * @private
     */
    __refreshDevice(msg) {
        return co.wrap(function*(_this, msg) {
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            let device = yield DbDevice.findOne({nodeId: msgObj.nodeId, id: msgObj.id});
            device.sensor = msgObj.sensor;
            device.unit = msgObj.unit;
            yield device.save();
        })(this, msg);
    }
}

module.exports = new DeviceService();