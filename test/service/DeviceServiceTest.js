const debug = require('debug')('mqtt-device-registry.test.DeviceServiceTest');
const expect = require("chai").expect;
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const amqp = require('amqplib');
const co = require("co");
const uuid = require('uuid');
// Require Service to test
const DeviceService = require("../../src/services/device_service/DeviceService");

// Require Constants
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const NodeServiceRoutingKey = require("../../src/services/node_service/constants/NodeServiceRoutingKey");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const DeviceServiceRoutingKey = require("../../src/services/device_service/constants/DeviceServiceRoutingKey");
const DeviceServiceQueue = require("../../src/services/device_service/constants/DeviceServiceQueue");

// Require Helper
const AmqpHelper = require("../../src/helper/AmqpHelper");
const AmqpTestHelper = require("../AmqpTestHelper/AmqpTestHelper");


// Require MongoDb model
const DbDevice = require("../../src/services/device_service/db/Device");

describe('DeviceServiceTest', function () {

    let connection;
    let channel;

    before(function () {
        "use strict";
        return co.wrap(function *() {
            connection = yield amqp.connect(process.env.RABBIT_MQ_URI);
            channel = yield connection.createChannel();
            return yield DeviceService.start(process.env.MONGODB_URI, process.env.RABBIT_MQ_URI);
        })().catch(console.log);
    });

    after(function () {
        DeviceService.stop();
    });

    describe("device message- device does not exist", function () {
        "use strict";

        beforeEach(function () {
            return DbDevice.find({}).remove().exec();
        });

        it('checking if created', function (done) {
            "use strict";
            AmqpTestHelper.createQueueAndBindOnce(
                channel,
                ()=> {
                    AmqpTestHelper.publish(channel, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, {
                        nodeId: "nodeid",
                        id: "deviceid",
                        unit: "unit",
                        sensor: true
                    });
                },
                AmqpExchanges.DEVICE_API_EXCHANGE,
                DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT_STORED).then((msg)=> {
                DbDevice.findOne({nodeId: "nodeid", id: "deviceid"}).then((d)=> {
                    expect(d).to.not.be.null;
                    done();
                })
            }).catch(debug);
        });
    });


    describe("device message -device does exist", function () {
        "use strict";

        beforeEach(function (done) {
            DbDevice.find({}).remove().exec().then(()=> {
                return new DbDevice({
                    nodeId: "nodeid",
                    id: "deviceid",
                    sensor: false,
                    unit: "unit"
                }).save().then(()=>done());
            });
        });

        it('checking if updated', function (done) {
            "use strict";
            AmqpTestHelper.createQueueAndBindOnce(
                channel,
                ()=> {
                    AmqpTestHelper.publish(channel, AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, {
                        nodeId: "nodeid",
                        id: "deviceid",
                        unit: "unit_new",
                        sensor: false
                    });
                },
                AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE_STORED)
                .then((msg)=> {
                    DbDevice.findOne({nodeId: "nodeid", id: "deviceid"}).then((d)=> {
                        expect(d).to.not.be.null;
                        expect(d).to.have.deep.property("nodeId", "nodeid");
                        expect(d).to.have.deep.property("id", "deviceid");
                        expect(d).to.have.deep.property("unit", "unit_new");
                        expect(d).to.have.deep.property("sensor", false);
                        done();
                    }).catch(debug);
                });
        });
    });

    describe("rpc test", function () {
        "use strict";

        beforeEach(function (done) {
            DbDevice.find({}).remove().exec().then(()=> {
                return Promise.all(
                    [
                        new DbDevice({
                            nodeId: "nodeid",
                            id: "deviceid1",
                            sensor: false,
                            unit: "unit"
                        }).save(),
                        new DbDevice({
                            nodeId: "nodeid",
                            id: "deviceid2",
                            sensor: true,
                            unit: "unit"
                        }).save(),
                        new DbDevice({
                            nodeId: "nodeid2",
                            id: "deviceid",
                            sensor: false,
                            unit: "unit",
                            store: {maxAgeMs: 60 * 1000}
                        }).save(),
                        new DbDevice({
                            nodeId: "nodeid3",
                            id: "deviceid",
                            sensor: false,
                            unit: "unit",
                            store: {maxCount: 100}
                        }).save(),
                    ]).then(()=>done());
            });
        });

        it("get all devices", function (done) {
            AmqpHelper.rpcRequest({}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel).then((response)=> {
                //expect(response).to.have.deep.property("")
                expect(response.length).to.equal(4);
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property('nodeId', 'nodeid');
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property('id', 'deviceid1');
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property('sensor', false);
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property('unit', 'unit');
                done();
            }).catch(debug);
        });

        it("get all devices - limit 1", function (done) {
            AmqpHelper.rpcRequest({limit: 1}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel).then((response)=> {
                //expect(response).to.have.deep.property("")
                expect(response.length).to.equal(1);
                done();
            }).catch(debug);
        });

        it("get all sensors", function (done) {
            AmqpHelper.rpcRequest({sensor: true}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel).then((response)=> {
                //expect(response).to.have.deep.property("")
                expect(response.length).to.equal(1);
                expect(response[0]).to.have.deep.property("id", "deviceid2");
                done();
            }).catch(debug);
        });

        it("get all actors", function (done) {
            AmqpHelper.rpcRequest({sensor: false}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel).then((response)=> {
                //expect(response).to.have.deep.property("")
                expect(response.length).to.equal(3);
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property("sensor", false);
                done();
            }).catch(debug);
        });

        it("get all for node 'nodeid'", function (done) {
            AmqpHelper.rpcRequest({nodeId: 'nodeid'}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel).then((response)=> {
                expect(response.length).to.equal(2);
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property("sensor", false);
                expect(response.find((device)=>device.id === 'deviceid2')).to.have.deep.property("sensor", true);
                done();
            }).catch(debug);
        });


        it("get all for node 'nodeid' and device 'deviceid1'", function (done) {
            AmqpHelper.rpcRequest({
                nodeId: 'nodeid',
                id: 'deviceid1'
            }, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel).then((response)=> {
                expect(response.length).to.equal(1);
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property("sensor", false);
                done();
            }).catch(debug);
        });

        it("set store option by date", function (done) {
            AmqpHelper.rpcRequest({
                nodeId: "nodeid",
                id: "deviceid2",
                store: {maxAgeMs: 60 * 1000}
            }, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_SET_DEVICE_STORAGE, channel).then((response)=> {
                AmqpHelper.rpcRequest({nodeId: 'nodeid'}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, channel).then((response)=> {
                    expect(response.length).to.equal(2);
                    expect(response.find((device)=>device.id === 'deviceid2')).to.have.deep.property("store.maxAgeMs", 60000);
                    done();
                }).catch(debug);
            }).catch(debug);
        });

    });
});