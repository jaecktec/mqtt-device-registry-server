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

//const DeviceServiceRoutingKey = require("../device_service/constants/DeviceServiceRoutingKey");

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
            channel.assertQueue(ValueServiceQueue.valueRpcQueue, {exclusive: false, durable: true});

            yield AmqpExchanges.createExchanges(channel);

            yield [
                channel.bindQueue(ValueServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY),
                channel.bindQueue(ValueServiceQueue.newValueQueue, AmqpExchanges.VALUE_API_EXCHANGE, ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW),
                channel.bindQueue(ValueServiceQueue.valueRpcQueue, AmqpExchanges.VALUE_API_EXCHANGE, ValueServiceRoutingKey.ROUTING_KEY_RPC_GET_VALUE),
            ];

            channel.consume(ValueServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onValueMessage), {noAck: false});
            channel.consume(ValueServiceQueue.newValueQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__createNewValue), {noAck: false});
            channel.consume(ValueServiceQueue.valueRpcQueue, (msg)=> AmqpHelper.handleRpcRquest(msg, channel, _this.__handleGet), {noAck: false});

            // MONGODB connect
            if (!mongoose.connection.readyState) {
                yield mongoose.connect(_mongoUrl);
            }

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
            debug(msg);
            channel.publish(
                AmqpExchanges.VALUE_API_EXCHANGE,
                ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW,
                AmqpHelper.objToBuffer(msg));
        })(this, msg, channel);
    }

    /**
     * Saves Value
     * @param msg amqp message
     * @returns {*} promise
     * @private
     */
    __createNewValue(msg, channel) {
        return co.wrap(function*(_this, msg, channel) {
            debug("create new value", msg);
            let value = yield new DbValue({
                nodeId: msg.nodeId,
                deviceId: msg.deviceId,
                value: msg.message,
                created: new Date()
            }).save();

            // disabled because cant test it
            // let device = (yield AmqpHelper.rpcRequest({
            //     nodeId: msg.nodeId,
            //     id: msg.deviceId
            // }, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel))[0];
            // let valuesCount = yield DbValue.count({
            //     nodeId: msg.nodeId,
            //     deviceId: msg.deviceId
            // });
            // if (device.store && device.store.maxCount && device.store.maxCount < valuesCount) {
            //     let all = yield DbValue.find().sort({_id: -1});
            //     let removeValues = all.slice(device.store.maxCount, all.length);
            //     yield Promise.all(removeValues.map(value => value.remove()));
            // }

            channel.publish(
                AmqpExchanges.VALUE_API_EXCHANGE,
                ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW_STORED,
                AmqpHelper.objToBuffer(value));
            return yield Promise.resolve();
        })(this, msg, channel);
    }

    __handleGet(request) {
        let nodeId = request.nodeId;
        let deviceId = request.deviceId;
        return co.wrap(function*() {
            let values = yield DbValue.find({
                nodeId: nodeId,
                deviceId: deviceId
            });
            return yield Promise.resolve(values);
        })();
    }
}

module.exports = new ValueService();