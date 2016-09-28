/**
 * Created by const on 06.09.2016.
 */
var mockrequire = require('mock-require');
const debug = require('debug')('mqtt-device-registry.test.NodeServiceTest');
const chai = require("chai");
chai.use(require('chai-datetime'));
const expect = chai.expect;

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

// Mocking AMQP
const DummyAmqp = require("../DummyAmqp/DummyAmqp");
const DummyAmqpChannel = require("../DummyAmqp/DummyAmqpChannel");
const DummyAmqpConnection = require("../DummyAmqp/DummyAmqpConnection");
mockrequire('amqplib', DummyAmqp);

// Require Service to test
const NodeService = require("../../src/services/node_service/NodeService");

// Require Constants
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const NodeServiceRoutingKey = require("../../src/services/node_service/constants/NodeServiceRoutingKey");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const NodeServiceQueue = require("../../src/services/node_service/constants/NodeServiceQueue");

// Require Helper
const AmqpHelper = require("../../src/helper/AmqpHelper");

// Require MongoDb model
const DbNode = require("../../src/services/node_service/db/Node");

describe('NodeServiceTest', function () {
    before(function () {
        "use strict";
        return NodeService.start(process.env.MONGODB_URI, "");
    });

    after(function () {
        NodeService.stop();
    });

    beforeEach(function (done) {
        DummyAmqpChannel.clear("test");
        done();
    });

    describe('device message - node does not exist', function () {

        beforeEach(function () {
            "use strict";
            return DbNode.find({id: "nodeid"}).remove().exec();
        });

        it('checking correct routing', function (done) {
            "use strict";
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY);
            DummyAmqpChannel.consume("test", function (msgBuffer) {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                expect(msg.id).to.equal("deviceid");
                expect(msg.unit).to.equal("unit");
                expect(msg.sensor).to.equal(true);
                done();
            });

            //noinspection ES6ModulesDependencies
            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid",
                id: "deviceid",
                unit: "unit",
                sensor: true
            })));
        });

        it('checking if created', function (done) {
            "use strict";

            DummyAmqpChannel.debugBindToAfter(
                NodeServiceQueue.nodeConnectedQueue,
                AmqpExchanges.NODE_API_EXCHANGE,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY, ()=> {
                    debug("Searhing...");
                    DbNode.findOne({id: "nodeid"}).then(function (d) {
                        expect(d).to.not.be.null;
                        done();
                    }).catch(debug);
                });


            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid",
                id: "deviceid",
                unit: "unit",
                sensor: true
            })));
        });
    });


    describe('device message - node does exist', function () {
        "use strict";

        beforeEach(function (done) {
            DbNode.find({}).remove().exec().then(()=> {
                Promise.all([
                    new DbNode({
                        id: "nodeid",
                        first_seen: new Date(2000, 12, 1),
                        last_seen: new Date(2000, 12, 1),
                        disconnected: new Date(1999, 12, 1)
                    }).save(), new DbNode({
                        id: "nodeid_disconnected",
                        first_seen: new Date(2000, 12, 1),
                        last_seen: new Date(2000, 12, 1),
                        disconnected: new Date(2001, 12, 1)
                    }).save(), new DbNode({
                        id: "nodeid2",
                        first_seen: new Date(2000, 12, 1),
                        last_seen: new Date(2000, 12, 1),
                        disconnected: null
                    }).save(), new DbNode({
                        id: "nodeid3",
                        first_seen: new Date(2000, 12, 1),
                        last_seen: new Date(2000, 12, 1),
                        disconnected: null
                    }).save()]).then(()=>done());
            });
        });

        it('checking correct routing', function (done) {
            "use strict";
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY);
            DummyAmqpChannel.consume("test", function (msgBuffer) {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                expect(msg.id).to.equal("deviceid");
                expect(msg.unit).to.equal("unit");
                expect(msg.sensor).to.equal(true);
                done();
            });

            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid",
                id: "deviceid",
                unit: "unit",
                sensor: true
            })));
        });

        it('checking if updated', function (done) {
            "use strict";

            DummyAmqpChannel.debugBindToAfter(
                NodeServiceQueue.nodeReconnectedQueue,
                AmqpExchanges.NODE_API_EXCHANGE,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY, ()=> {
                    DbNode.findOne({id: "nodeid"}).then(function (d) {
                        expect(d).to.not.be.null;
                        expect(d).to.have.deep.property("id", "nodeid");
                        expect(d["first_seen"]).to.equalDate(new Date(2000, 12, 1));
                        expect(d["last_seen"]).to.afterDate(new Date(2000, 12, 1));
                        done();
                    }).catch(debug);
                });


            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: 'nodeid',
                id: "deviceid",
                unit: "unit_new",
                sensor: false
            })));
        });

    });

    describe('rpc tests', function () {
        "use strict";

        beforeEach(function (done) {
            DbNode.find({}).remove().exec().then(()=> {
                Promise.all([
                    new DbNode({
                        id: "nodeid",
                        first_seen: new Date(2000, 12, 1),
                        last_seen: new Date(2000, 12, 1),
                        disconnected: new Date(1999, 12, 1)
                    }).save(), new DbNode({
                        id: "nodeid_disconnected",
                        first_seen: new Date(2000, 12, 2),
                        last_seen: new Date(2000, 12, 2),
                        disconnected: new Date(2001, 12, 2)
                    }).save(), new DbNode({
                        id: "nodeid2",
                        first_seen: new Date(2000, 12, 3),
                        last_seen: new Date(2000, 12, 3),
                        disconnected: null
                    }).save(), new DbNode({
                        id: "nodeid3",
                        first_seen: new Date(2000, 12, 4),
                        last_seen: new Date(2000, 12, 4),
                        disconnected: null
                    }).save()]).then(()=>done());
            });
        });

        it('loading node by nodeId', function (done) {
            AmqpHelper.rpcRequest({id: "nodeid"}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, DummyAmqpChannel).then((response)=> {
                debug(response);
                expect(response[0]).to.have.deep.property("id", "nodeid");
                done();
            }).catch(debug);
        });

        it('loading all nodes and check count', function (done) {
            AmqpHelper.rpcRequest({}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, DummyAmqpChannel).then((response)=> {
                debug(response);
                expect(response.length).to.equal(4);
                expect(response.map((n)=> n.id)).include('nodeid_disconnected');
                done();
            }).catch(debug);
        });

        it('loading all nodes, limit it and check count', function (done) {
            AmqpHelper.rpcRequest({limit: 2}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, DummyAmqpChannel).then((response)=> {
                debug(response);
                expect(response.length).to.equal(2);
                expect(response.map((n)=> n.id)).include('nodeid');
                expect(response.map((n)=> n.id)).include('nodeid_disconnected');
                done();
            }).catch(debug);
        });

        it('loading all donnected nodes and node disconnected is not in there', function (done) {
            AmqpHelper.rpcRequest({onlyConnected: true}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, DummyAmqpChannel).then((response)=> {
                expect(response.map((n)=> n.id)).not.include('nodeid_disconnected');
                done();
            }).catch(debug);
        });
    });

    describe('node disconnect message - node exists', function () {
        "use strict";

        beforeEach(function (done) {
            DbNode.find({id: "nodeid"}).remove().exec().then(()=> {
                new DbNode({
                    id: "nodeid",
                    first_seen: new Date(2000, 12, 1),
                    last_seen: new Date(2000, 12, 1),
                    disconnected: null
                }).save().then(()=>done());
            });
        });

        it("check correct routing", function (done) {
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY);
            DummyAmqpChannel.consume("test", function (msgBuffer) {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                done();
            });

            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.NODE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid"
            })));
        });

        it("check node if node is updated", function (done) {

            DummyAmqpChannel.debugBindToAfter(
                NodeServiceQueue.nodeDisconnectedQueue,
                AmqpExchanges.NODE_API_EXCHANGE,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY, ()=> {
                    DbNode.findOne({id: "nodeid"}).then(function (d) {
                        expect(d).to.not.be.null;
                        expect(d).to.have.deep.property("id", "nodeid");
                        expect(d["first_seen"]).to.equalDate(new Date(2000, 12, 1));
                        expect(d["last_seen"]).to.afterDate(new Date(2000, 12, 1));
                        expect(d.disconnected).to.not.null;
                        done();
                    }).catch(debug);
                });

            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.NODE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid"
            })));
        });
    });

});