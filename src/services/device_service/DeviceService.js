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
            DeviceServiceQueue.createQueues(channel);
            yield AmqpExchanges.createExchanges(channel);

            yield [
                channel.bindQueue(DeviceServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY),
                channel.bindQueue(DeviceServiceQueue.deviceConnectedQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT),
                channel.bindQueue(DeviceServiceQueue.deviceReconnectedQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE),

                // RPC
                channel.bindQueue(DeviceServiceQueue.deviceRpcGetQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE),
                channel.bindQueue(DeviceServiceQueue.deviceRpcSetQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_SET_DEVICE_STORAGE),
            ];

            channel.consume(DeviceServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onDeviceMessage), {noAck: false});
            channel.consume(DeviceServiceQueue.deviceConnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__createDevice), {noAck: false});
            channel.consume(DeviceServiceQueue.deviceReconnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__refreshDevice), {noAck: false});

            // RPC
            channel.consume(DeviceServiceQueue.deviceRpcGetQueue, (msg)=> AmqpHelper.handleRpcRquest(msg, channel, _this.__handleGet));
            channel.consume(DeviceServiceQueue.deviceRpcSetQueue, (msg)=> AmqpHelper.handleRpcRquest(msg, channel, _this.__handleSet));

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

    __handleSet(request) {
        const id = request.id;
        const nodeId = request.nodeId;
        const store = request.store;

        return co.wrap(function*() {
            let device = yield DbDevice.findOne({nodeId: nodeId, id: id});
            device.store = store;
            yield device.save();
            return yield Promise.resolve(device);
        })();
    }

    __handleGet(request) {
        let aggregateParams = [{
            $project: {
                _id: 1,
                id: 1,
                sensor: 1,
                unit: 1,
                nodeId: 1,
                store: 1
            }
        }];
        const ids = request.ids;
        const id = request.id;
        const limit = request.limit;
        const onlySensor = request.sensor;
        const nodeId = request.nodeId;

        return co.wrap(function*() {
            if (ids) {
                aggregateParams.push({$match: {id: {$in: ids}}});
                }
            if (nodeId) {
                const aggregateMatch = aggregateParams.find((param)=>param['$match']) ? aggregateParams.find((param)=>param['$match']) : {$match: {}};
                aggregateParams = aggregateParams.filter((param)=>!param['$match']);
                aggregateMatch['$match']['nodeId'] = nodeId;
                aggregateParams.push(aggregateMatch);
            }
            if (id) {
                const aggregateMatch = aggregateParams.find((param)=>param['$match']) ? aggregateParams.find((param)=>param['$match']) : {$match: {}};
                aggregateParams = aggregateParams.filter((param)=>!param['$match']);
                aggregateMatch['$match']['id'] = id;
                aggregateParams.push(aggregateMatch);
            }
            if (limit) {
                aggregateParams.push({$sort: {id: 1}});
                aggregateParams.push({$limit: limit});
            }

            if (request.sensor !== undefined) {
                const aggregateMatch = aggregateParams.find((param)=>param['$match']) ? aggregateParams.find((param)=>param['$match']) : {$match: {}};
                aggregateParams = aggregateParams.filter((param)=>!param['$match']);
                aggregateMatch['$match']['sensor'] = onlySensor;
                aggregateParams.push(aggregateMatch);
            }
            debug("querieing: ", aggregateParams);
            return yield DbDevice.aggregate(aggregateParams);
            }
        )();
    }
}

module.exports = new DeviceService();