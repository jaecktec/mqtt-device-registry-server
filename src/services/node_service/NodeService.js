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


            yield [
                channel.bindQueue(NodeServiceQueue.mainQueue, AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.mainQueue, AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.nodeConnectedQueue, AmqpExchanges.mqttGatewayExchange, NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.nodeReconnectedQueue, AmqpExchanges.mqttGatewayExchange, NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY),
                channel.bindQueue(NodeServiceQueue.nodeDisconnectedQueue, AmqpExchanges.mqttGatewayExchange, NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY)];

            channel.consume(NodeServiceQueue.mainQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__onDeviceMessage), {noAck: false});
            channel.consume(NodeServiceQueue.nodeConnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__createNode), {noAck: false});
            channel.consume(NodeServiceQueue.nodeReconnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__refreshNode), {noAck: false});
            channel.consume(NodeServiceQueue.nodeDisconnectedQueue, (msg)=> AmqpHelper.handleAck(msg, channel, _this.__updateDisconnected), {noAck: false});

            // MONGODB connect
            yield mongoose.connect(_mongoUrl);

        })(this, mongoUrl, amqpUrl);
    }

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
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            // check if node exists:
            let node = yield DbNode.findOne({id: msgObj.nodeId});
            if (!node) {
                // publish create Node
                channel.publish(
                    AmqpExchanges.mqttGatewayExchange,
                    NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY,
                    new Buffer(msg.content));
            } else {
                // publish update Node
                channel.publish(
                    AmqpExchanges.mqttGatewayExchange,
                    NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY,
                    new Buffer(msg.content));
            }

            if (Object.keys(msgObj).length == 1 && msgObj.nodeId !== undefined) {
                // node disconnected
                channel.publish(
                    AmqpExchanges.mqttGatewayExchange,
                    NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY,
                    new Buffer(msg.content));
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
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            console.log("__createNode", msgObj);
            let node = yield DbNode.findOne({id: msgObj.nodeId});
            if (!node) {
                yield new DbNode({
                    id: msgObj.nodeId,
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
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            console.log("__refreshNode", msgObj);
            let node = yield DbNode.findOne({id: msgObj.nodeId});
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
            let msgObj = AmqpHelper.bufferToObj(msg.content);
            console.log("__updateDisconnected", msgObj);
            let node = yield DbNode.findOne({id: msgObj.nodeId});
            node.disconnected = new Date();
            yield node.save();
        })(this, msg);
    }


}

module.exports = new NodeService();