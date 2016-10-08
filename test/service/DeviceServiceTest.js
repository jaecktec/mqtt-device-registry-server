const mockrequire = require('mock-require');
const debug = require('debug')('mqtt-device-registry.test.DeviceServiceTest');
const expect = require("chai").expect;
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

// Mocking AMQP
const DummyAmqp = require("../DummyAmqp/DummyAmqp");
const DummyAmqpChannel = require("../DummyAmqp/DummyAmqpChannel");
const DummyAmqpConnection = require("../DummyAmqp/DummyAmqpConnection");
mockrequire('amqplib', DummyAmqp);

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

// Require MongoDb model
const DbDevice = require("../../src/services/device_service/db/Device");

describe('DeviceServiceTest', function () {
    before(function () {
        "use strict";
        return DeviceService.start(process.env.MONGODB_URI, "");
    });

    after(function () {
        DeviceService.stop();
    });

    beforeEach(function (done) {
        DummyAmqpChannel.clear("test");
        done();
    });

    describe("device message- device does not exist", function () {
        "use strict";

        beforeEach(function () {
            return DbDevice.find({}).remove().exec();
        });

        it('checking routing', function (done) {
            "use strict";
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT);
            DummyAmqpChannel.consume("test", (msgBuffer)=> {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                expect(msg.id).to.equal("deviceid");
                expect(msg.unit).to.equal("unit");
                expect(msg.sensor).to.equal("sensor");
                done();
            });
            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid",
                id: "deviceid",
                unit: "unit",
                sensor: "sensor"
            })));
        });

        it('checking if created', function (done) {
            "use strict";
            DummyAmqpChannel.debugBindToAfter(DeviceServiceQueue.deviceConnectedQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT, ()=> {
                debug("Searhing...");
                DbDevice.findOne({nodeId: "nodeid", id: "deviceid"}).then((d)=> {
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

        it('checking routing', function (done) {
            "use strict";

            DummyAmqpChannel.bindQueue("test", AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE);

            DummyAmqpChannel.consume("test", (msgBuffer)=> {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                expect(msg.id).to.equal("deviceid");
                expect(msg.unit).to.equal("unit_new");
                expect(msg.sensor).to.equal("sensor_new");
                done();
            });

            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid",
                id: "deviceid",
                unit: "unit_new",
                sensor: "sensor_new"
            })));

        });

        it('checking if updated', function (done) {
            "use strict";

            DummyAmqpChannel.debugBindToAfter(DeviceServiceQueue.deviceReconnectedQueue, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE, ()=> {
                DbDevice.findOne({nodeId: "nodeid", id: "deviceid"}).then((d)=> {
                    expect(d).to.not.be.null;
                    expect(d).to.have.deep.property("nodeId", "nodeid");
                    expect(d).to.have.deep.property("id", "deviceid");
                    expect(d).to.have.deep.property("unit", "unit_new");
                    expect(d).to.have.deep.property("sensor", false);
                    done();
                }).catch(debug);
            });
            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid",
                id: "deviceid",
                unit: "unit_new",
                sensor: false
            })));
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
            AmqpHelper.rpcRequest({}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, DummyAmqpChannel).then((response)=> {
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
            AmqpHelper.rpcRequest({limit: 1}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, DummyAmqpChannel).then((response)=> {
                //expect(response).to.have.deep.property("")
                expect(response.length).to.equal(1);
                done();
            }).catch(debug);
        });

        it("get all sensors", function (done) {
            AmqpHelper.rpcRequest({sensor: true}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, DummyAmqpChannel).then((response)=> {
                //expect(response).to.have.deep.property("")
                expect(response.length).to.equal(1);
                expect(response[0]).to.have.deep.property("id", "deviceid2");
                done();
            }).catch(debug);
        });

        it("get all actors", function (done) {
            AmqpHelper.rpcRequest({sensor: false}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, DummyAmqpChannel).then((response)=> {
                //expect(response).to.have.deep.property("")
                expect(response.length).to.equal(3);
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property("sensor", false);
                done();
            }).catch(debug);
        });

        it("get all for node 'nodeid'", function (done) {
            AmqpHelper.rpcRequest({nodeId: 'nodeid'}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, DummyAmqpChannel).then((response)=> {
                expect(response.length).to.equal(2);
                expect(response.find((device)=>device.id === 'deviceid1')).to.have.deep.property("sensor", false);
                expect(response.find((device)=>device.id === 'deviceid2')).to.have.deep.property("sensor", true);
                done();
            }).catch(debug);
        });

        it("set store option by date", function (done) {
            AmqpHelper.rpcRequest({
                nodeId: "nodeid",
                id: "deviceid2",
                store: {maxAgeMs: 60 * 1000}
            }, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_SET_DEVICE_STORAGE, DummyAmqpChannel).then((response)=> {
                AmqpHelper.rpcRequest({nodeId: 'nodeid'}, AmqpExchanges.DEVICE_API_EXCHANGE, DeviceServiceRoutingKey.ROUTING_KEY_RPC_GET_DEVICE, DummyAmqpChannel).then((response)=> {
                    expect(response.length).to.equal(2);
                    expect(response.find((device)=>device.id === 'deviceid2')).to.have.deep.property("store.maxAgeMs", 60000);
                    done();
                }).catch(debug);
            }).catch(debug);
        });

    });
});

