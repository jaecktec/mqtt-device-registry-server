/**
 * Created by const on 06.09.2016.
 */
const debug = require('debug')('mqtt-device-registry.test.NodeServiceTest');
const chai = require("chai");
chai.use(require('chai-datetime'));
const expect = chai.expect;

const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const amqp = require('amqplib');
const co = require("co");
const uuid = require('uuid');

// Require Service to test
const NodeService = require("../../src/services/node_service/NodeService");

// Require Constants
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const NodeServiceRoutingKey = require("../../src/services/node_service/constants/NodeServiceRoutingKey");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const NodeServiceQueue = require("../../src/services/node_service/constants/NodeServiceQueue");

// Require Helper
const AmqpHelper = require("../../src/helper/AmqpHelper");
const AmqpTestHelper = require("../AmqpTestHelper/AmqpTestHelper");

// Require MongoDb model
const DbNode = require("../../src/services/node_service/db/Node");

describe('NodeServiceTest', function () {

    let connection;
    let channel;

    before(function (done) {
        "use strict";
        co(function *() {
            connection = yield amqp.connect(process.env.RABBIT_MQ_URI);
            channel = yield connection.createChannel();
            yield NodeService.start(process.env.MONGODB_URI, process.env.RABBIT_MQ_URI);
        }).then(()=>done()).catch(console.log);
    });

    after(function () {
        NodeService.stop();
    });


    describe('device message - node does not exist', function () {

        beforeEach(function (done) {
            "use strict";
            DbNode.find({}).remove().then(()=> {
                done();
            });
        });

        it('checking if created', function (done) {
            "use strict";
            AmqpTestHelper.createQueueAndBindOnce(
                channel,
                ()=> {
                    channel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                        nodeId: "nodeid",
                        id: "deviceid",
                        unit: "unit",
                        sensor: true
                    })));
                },
                AmqpExchanges.NODE_API_EXCHANGE,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_CONNECTED_STORED
            ).then((msg)=> {
                debug("Searhing...");
                DbNode.findOne({id: "nodeid"}).then(function (d) {
                    expect(d).to.not.be.null;
                    done();
                }).catch(debug);
            });
        });
    });

    describe('device message - node does exist', function () {
        "use strict";

        beforeEach(function (done) {
            DbNode.find({}).remove().then(()=> {
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

        it('checking if updated', function (done) {
            "use strict";
            AmqpTestHelper.createQueueAndBindOnce(
                channel,
                ()=> {
                    channel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                        nodeId: 'nodeid',
                        id: "deviceid",
                        unit: "unit_new",
                        sensor: false
                    })));
                },
                AmqpExchanges.NODE_API_EXCHANGE,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_RECONNECTED_STORED_ROUTING_KEY
            ).then((msg)=> {
                DbNode.findOne({id: "nodeid"}).then(function (d) {
                    expect(d).to.not.be.null;
                    expect(d).to.have.deep.property("id", "nodeid");
                    expect(d["first_seen"]).to.equalDate(new Date(2000, 12, 1));
                    expect(d["last_seen"]).to.afterDate(new Date(2000, 12, 1));
                    done();
                }).catch(debug);
            });
        });

    });

    describe('rpc tests', function () {
        "use strict";

        beforeEach(function (done) {
            DbNode.find({}).remove().then(()=> {
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
            AmqpHelper.rpcRequest({id: "nodeid"}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, channel).then((response)=> {
                debug(response);
                expect(response[0]).to.have.deep.property("id", "nodeid");
                done();
            }).catch(debug);
        });

        it('loading all nodes and check count', function (done) {
            AmqpHelper.rpcRequest({}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, channel).then((response)=> {
                debug(response);
                expect(response.length).to.equal(4);
                expect(response.map((n)=> n.id)).include('nodeid_disconnected');
                done();
            }).catch(debug);
        });

        it('loading all nodes, limit it and check count', function (done) {
            AmqpHelper.rpcRequest({limit: 2}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, channel).then((response)=> {
                debug(response);
                expect(response.length).to.equal(2);
                expect(response.map((n)=> n.id)).include('nodeid');
                expect(response.map((n)=> n.id)).include('nodeid_disconnected');
                done();
            }).catch(debug);
        });

        it('loading all donnected nodes and node disconnected is not in there', function (done) {
            AmqpHelper.rpcRequest({onlyConnected: true}, AmqpExchanges.NODE_API_EXCHANGE, NodeServiceRoutingKey.ROUTING_KEY_RPC_GET_NODE, channel).then((response)=> {
                expect(response.map((n)=> n.id)).not.include('nodeid_disconnected');
                done();
            }).catch(debug);
        });
    });

    describe('node disconnect message - node exists', function () {
        "use strict";

        beforeEach(function (done) {
            DbNode.find({id: "nodeid"}).remove().then(()=> {
                new DbNode({
                    id: "nodeid",
                    first_seen: new Date(2000, 12, 1),
                    last_seen: new Date(2000, 12, 1),
                    disconnected: null
                }).save().then(()=>done());
            });
        });

        it("check node if node is updated", function (done) {
            AmqpTestHelper.createQueueAndBindOnce(
                channel,
                ()=> {
                    channel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.NODE_ROUTING_KEY, new Buffer(JSON.stringify({
                        nodeId: "nodeid"
                    })));
                },
                AmqpExchanges.NODE_API_EXCHANGE,
                NodeServiceRoutingKey.ROUTING_KEY_NODE_DISCONNECTED_STORED_ROUTING_KEY
            ).then(()=> {
                DbNode.findOne({id: "nodeid"}).then(function (d) {
                    expect(d).to.not.be.null;
                    expect(d).to.have.deep.property("id", "nodeid");
                    expect(d["first_seen"]).to.equalDate(new Date(2000, 12, 1));
                    expect(d.disconnected).to.not.null;
                    done();
                }).catch(debug);
            });
        });
    });

});