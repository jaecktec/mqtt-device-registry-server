const debug = require('debug')('mqtt-device-registry.NodeService');
const assert = require('assert');
var co = require('co');
var amqp = require('amqplib');
const mongoose = require('mongoose');

const NodeServiceQueue = require("./constants/NodeServiceQueue");
const AmqpExchanges = require("../../constants/AmqpExchanges");
const AmqpHelper = require("../../helper/AmqpHelper");
const NodeServiceRoutingKey = require("./constants/NodeServiceRoutingKey");
const MqttGatewayRoutingKey = require("../mqtt_gateway/constants/MqttGatewayRoutingKey");

const DbNode = require("./db/Node");

class NodeService {

    start(mongoUrl, amqpUrl) {
        return co.wrap(function *(_this, _mongoUrl, _amqpUrl) {

            // AMQP connect and setup
            let connection = yield amqp.connect(_amqpUrl);
            var channel = yield connection.createConfirmChannel();
            channel.prefetch(1);
            channel.assertQueue(NodeServiceQueue.mainQueue, {exclusive: false, durable: true});
            channel.assertQueue(NodeServiceQueue.nodeConnectedQueue, {exclusive: false, durable: true});
            channel.assertQueue(NodeServiceQueue.nodeReconnectedQueue, {exclusive: false, durable: true});
            channel.assertQueue(NodeServiceQueue.nodeDisconnectedQueue, {exclusive: false, durable: true});
            channel.assertQueue(NodeServiceQueue.nodeRpcQueue, {exclusive: false, durable: true});

            yield AmqpExchanges.createExchanges(channel);

            yield [
                channel.bindQueue(NodeServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.mainQueue, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.NODE_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.nodeConnectedQueue, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.nodeReconnectedQueue, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.nodeDisconnectedQueue, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.nodeRpcQueue, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE)];

            channel.consume(NodeServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onDeviceMessage), {noAck: false});
            channel.consume(NodeServiceQueue.nodeConnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__createNode), {noAck: false});
            channel.consume(NodeServiceQueue.nodeReconnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__refreshNode), {noAck: false});
            channel.consume(NodeServiceQueue.nodeDisconnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__updateDisconnected), {noAck: false});
            channel.consume(NodeServiceQueue.nodeRpcQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__handleGet), {noAck: false});

            // MONGODB connect
            yield mongoose.connect(_mongoUrl);

        })(this, mongoUrl, amqpUrl);
    }

    //noinspection JSMethodCanBeStatic
    stop() {
        mongoose.connection.close();
    }

    /**
     * checks if node already exists. If not, publishes amqp message to exchange with routin key:
     * -> not existent: NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY
     * -> exists: NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY
     * @param msg amqp message
     * @param channel amqp chanel
     * @returns {*} promise
     * @private
     */
    __onDeviceMessage(msg, channel) {
        return co.wrap(function*(_this, msg) {
            // check if node exists:
            let node = yield DbNode.findOne({id: msg.nodeId});
            if (!node) {
                // publish create Node
                channel.publish(
                    AmqpExchanges.NODE_API_EXCHANGE,
                    NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY,
                    AmqpHelper.objToBuffer(msg));
            } else {
                // publish update Node
                channel.publish(
                    AmqpExchanges.NODE_API_EXCHANGE,
                    NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY,
                    AmqpHelper.objToBuffer(msg));
            }

            if (Object.keys(msg).length == 1 && msg.nodeId !== undefined) {
                // node disconnected
                channel.publish(
                    AmqpExchanges.NODE_API_EXCHANGE,
                    NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY,
                    AmqpHelper.objToBuffer(msg));
            }

        })(this, msg);
    }

    /**
     * creates node in mongodb
     * @param msg amqpmessage of node that not exists
     * @returns {*}
     * @private
     */
    __createNode(msg) {
        return co.wrap(function*(_this, msg) {
            debug("__createNode", msg);
            let node = yield DbNode.findOne({id: msg.nodeId});
            if (!node) {
                yield new DbNode({
                    id: msg.nodeId,
                    first_seen: new Date(),
                    last_seen: new Date(),
                    disconnected: null
                }).save();
            }
        })(this, msg);
    }

    /**
     * Updates last_seen of node and sets disconnected to null
     * @param msg amqp message
     * @returns {*} promise
     * @private
     */
    __refreshNode(msg) {
        return co.wrap(function*(_this, msg) {
            debug("__refreshNode", msg);
            let node = yield DbNode.findOne({id: msg.nodeId});
            node.last_seen = new Date();
            node.disconnected = null;
            yield node.save();
        })(this, msg);
    }

    /**
     * sets disconnected to current date
     * @param msg amqp message
     * @returns {*} promise
     * @private
     */
    __updateDisconnected(msg) {
        return co.wrap(function*(_this, msg) {
            console.log("__updateDisconnected", msg);
            let node = yield DbNode.findOne({id: msg.nodeId});
            node.disconnected = new Date();
            yield node.save();
        })(this, msg);
    }


    __handleGet(request, channel) {
        const AGGREGATE_PROJECT = {
            $project: {
                _id: 0,
                id: 1,
                first_seen: 1,
                last_seen: 1,
                disconnected: 1,
                uptime: {$subtract: ["$last_seen", "$disconnected"]}
            }
        };
        const id = request.content.id;
        const maxCnt = request.content.maxCount;
        const onlyConnected = request.content.onlyConnected;

        return co.wrap(function*() {
                let nodes;
                if (id) {
                    nodes = yield DbNode.aggregate([
                        AGGREGATE_PROJECT,
                        {$match: {id: id}}
                    ]);
                } else {
                    if (!onlyConnected) {
                        nodes = yield DbNode.aggregate([
                            AGGREGATE_PROJECT
                        ]);
                    } else {
                        nodes = yield DbNode.aggregate([
                            AGGREGATE_PROJECT,
                            {$match: {uptime: {$gt: 0}}}
                        ]);
                    }
                }

                AmqpHelper.rpcRespond(nodes, request, channel);
            }
        )();
    }


}

module.exports = new NodeService();