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
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY);
            DummyAmqpChannel.consume("test", function (msgBuffer) {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                expect(msg.id).to.equal("deviceid");
                expect(msg.unit).to.equal("unit");
                expect(msg.sensor).to.equal(true);
                done();
            });

            //noinspection ES6ModulesDependencies
            DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
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
                AmqpExchanges.mqttGatewayExchange,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_ROUTING_KEY, ()=> {
                    debug("Searhing...");
                    DbNode.findOne({id: "nodeid"}).then(function (d) {
                        expect(d).to.not.be.null;
                        done();
                    }).catch(debug);
                });


            DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
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
            DbNode.find({id: "nodeid"}).remove().exec().then(()=> {
                new DbNode({
                    id: "nodeid",
                    first_seen: new Date(2000, 12, 1),
                    last_seen: new Date(2000, 12, 1),
                    disconnected: null
                }).save().then(()=>done());
            });
        });

        it('checking correct routing', function (done) {
            "use strict";
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY);
            DummyAmqpChannel.consume("test", function (msgBuffer) {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                expect(msg.id).to.equal("deviceid");
                expect(msg.unit).to.equal("unit");
                expect(msg.sensor).to.equal(true);
                done();
            });

            DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
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
                AmqpExchanges.mqttGatewayExchange,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_ROUTING_KEY, ()=> {
                    DbNode.findOne({id: "nodeid"}).then(function (d) {
                        expect(d).to.not.be.null;
                        expect(d).to.have.deep.property("id", "nodeid");
                        expect(d["first_seen"]).to.equalDate(new Date(2000, 12, 1));
                        expect(d["last_seen"]).to.afterDate(new Date(2000, 12, 1));
                        done();
                    }).catch(debug);
                });


            DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: 'nodeid',
                id: "deviceid",
                unit: "unit_new",
                sensor: false
            })));
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
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_ROUTING_KEY);
            DummyAmqpChannel.consume("test", function (msgBuffer) {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                done();
            });

            DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.NODE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid"
            })));
        });

        it("check node if node is updated", function (done) {

            DummyAmqpChannel.debugBindToAfter(
                NodeServiceQueue.nodeDisconnectedQueue,
                AmqpExchanges.mqttGatewayExchange,
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

            DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.NODE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid"
            })));
        });
    });

});