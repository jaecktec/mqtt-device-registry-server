const debug = require('debug')('mqtt-device-registry.DeviceService');
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
        //noinspection JSCheckFunctionSignatures
        return co.wrap(function*(_this, _mongoUrl, _amqpUrl) {

            // AMQP connect and setup
            let connection = yield amqp.connect(_amqpUrl);
            var channel = yield connection.createConfirmChannel();
            channel.prefetch(1);
            channel.assertQueue(DeviceServiceQueue.mainQueue, {exclusive: false, durable: true});
            channel.assertQueue(DeviceServiceQueue.deviceConnectedQueue, {exclusive: false, durable: true});
            channel.assertQueue(DeviceServiceQueue.deviceReconnectedQueue, {exclusive: false, durable: true});


            yield [
                channel.bindQueue(DeviceServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY),
                channel.bindQueue(DeviceServiceQueue.deviceConnectedQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT),
                channel.bindQueue(DeviceServiceQueue.deviceReconnectedQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE),
            ];

            channel.consume(DeviceServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onDeviceMessage), {noAck: false});
            channel.consume(DeviceServiceQueue.deviceConnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__createDevice), {noAck: false});
            channel.consume(DeviceServiceQueue.deviceReconnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__refreshDevice), {noAck: false});

            // MONGODB connect
            yield mongoose.connect(_mongoUrl);

        })(this, mongoUrl, amqpUrl);
    }

    //noinspection JSMethodCanBeStatic
    stop() {
        mongoose.connection.close();
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
        //noinspection JSCheckFunctionSignatures
        return co.wrap(function*(_this, msg, channel) {
            // check if device exists:
            let device = yield DbDevice.findOne({nodeId: msg.nodeId, id: msg.id});
            if (!device) {
                channel.publish(
                    AmqpExchanges.DEVICE_API_EXCHANGE,
                    DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT,
                    AmqpHelper.objToBuffer(msg));
            } else {
                channel.publish(
                    AmqpExchanges.DEVICE_API_EXCHANGE,
                    DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE,
                    AmqpHelper.objToBuffer(msg));
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
        //noinspection JSCheckFunctionSignatures
        return co.wrap(function*(_this, msg) {
            let device = yield DbDevice.findOne({nodeId: msg.nodeId, id: msg.id});
            if (!device) {
                let newDevice = new DbDevice({
                    nodeId: msg.nodeId,
                    id: msg.id,
                    sensor: msg.sensor,
                    unit: msg.unit
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
        //noinspection JSCheckFunctionSignatures
        return co.wrap(function*(_this, msg) {
            let device = yield DbDevice.findOne({nodeId: msg.nodeId, id: msg.id});
            device.sensor = msg.sensor;
            device.unit = msg.unit;
            yield device.save();
        })(this, msg);
    }


}

module.exports = new DeviceService();