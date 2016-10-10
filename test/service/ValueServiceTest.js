/**
 * Created by const on 06.09.2016.
 */
var mockrequire = require('mock-require');
const debug = require('debug')('mqtt-device-registry.test.ValueServiceTest');
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
const ValueService = require("../../src/services/value_service/ValueService");
const DeviceService = require("../../src/services/device_service/DeviceService");

// Require Constants
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const ValueServiceRoutingKey = require("../../src/services/value_service/constants/ValueServiceRoutingKey");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const ValueServiceQueue = require("../../src/services/value_service/constants/ValueServiceQueue");

// Require Helper
const AmqpHelper = require("../../src/helper/AmqpHelper");

// Require MongoDb model
const DbValue = require("../../src/services/value_service/db/Value");
const DbDevice = require("../../src/services/device_service/db/Device");
const DbNode = require("../../src/services/node_service/db/Node");


describe('ValueServiceTest', function () {
    before(function () {
        return ValueService.start(process.env.MONGODB_URI, "");
    });

    after(function () {
        ValueService.stop();
    });

    beforeEach(function (done) {
        DummyAmqpChannel.clear("test");
        done();
    });

    describe('value message', function () {

        before(function () {
            return DeviceService.start(process.env.MONGODB_URI, "");
        });

        after(function () {
            DeviceService.stop();
        });

        beforeEach(function (done) {
            "use strict";
            // clear all values
            Promise.all([
                DbValue.find({}).remove().exec(),
                DbDevice.find({}).remove().exec(),
                DbNode.find({}).remove().exec()
            ]).then(()=> {
                Promise.all([
                    new DbValue({
                        nodeId: "nodeid2",
                        deviceId: "deviceid",
                        created: new Date(1),
                        value: {num: 1}
                    }).save(),
                    new DbValue({
                        nodeId: "nodeid2",
                        deviceId: "deviceid",
                        created: new Date(2),
                        value: {num: 2}
                    }).save(),
                    new DbValue({
                        nodeId: "nodeid2",
                        deviceId: "deviceid",
                        created: new Date(3),
                        value: {num: 3}
                    }).save(),
                    new DbValue({
                        nodeId: "nodeid2",
                        deviceId: "deviceid",
                        created: new Date(4),
                        value: {num: 4}
                    }).save(),
                    new DbValue({
                        nodeId: "nodeid2",
                        deviceId: "deviceid",
                        created: new Date(5),
                        value: {num: 5}
                    }).save(),
                    new DbValue({
                        nodeId: "nodeid2",
                        deviceId: "deviceid",
                        created: new Date(6),
                        value: {num: 6}
                    }).save(),
                    new DbDevice({
                        id: "deviceid",
                        sensor: true,
                        unit: "001",
                        nodeId: "nodeid2",
                        store: {maxCount: 6, maxAgeMs: new Date().getMilliseconds() + 1}
                    }).save(),
                    new DbDevice({id: "deviceid", sensor: true, unit: "001", nodeId: "nodeid"}).save(),
                    new DbNode({id: "nodeid2", first_seen: new Date(0), last_seen: new Date(6)}).save()
                ]).then(()=>done());
            });
        });

        it('checking correct routing', function (done) {
            "use strict";
            DummyAmqpChannel.bindQueue("test", AmqpExchanges.VALUE_API_EXCHANGE, ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW);
            DummyAmqpChannel.consume("test", function (msgBuffer) {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.nodeId).to.equal("nodeid");
                expect(msg.deviceId).to.equal("deviceid");
                expect(msg.message).to.have.deep.property("value", "test");
                done();
            });

            //noinspection ES6ModulesDependencies
            DummyAmqpChannel.publish(AmqpExchanges.MQTT_GATEWAY_EXCHANGE, MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY, new Buffer(JSON.stringify({
                nodeId: "nodeid",
                deviceId: "deviceid",
                message: {value: "test"}
            })));
        });

        it('checking if value stored', function (done) {
            "use strict";

            DummyAmqpChannel.debugBindToAfter(
                ValueServiceQueue.newValueQueue,
                AmqpExchanges.VALUE_API_EXCHANGE,
                ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW, ()=> {
                    DbValue.findOne({
                        nodeId: "nodeid",
                        deviceId: "deviceid",
                        value: {value: "test"}
                    }).then(function (d) {
                        expect(d).to.not.be.null;
                        done();
                    }).catch(debug);
                });


            DummyAmqpChannel.publish(
                AmqpExchanges.MQTT_GATEWAY_EXCHANGE,
                MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY,
                new Buffer(JSON.stringify({
                    nodeId: "nodeid",
                    deviceId: "deviceid",
                    message: {value: "test"}
                })));
        });

        it('checking if value stored with limit', function (done) {
            "use strict";

            DummyAmqpChannel.debugBindToAfter(
                ValueServiceQueue.newValueQueue,
                AmqpExchanges.VALUE_API_EXCHANGE,
                ValueServiceRoutingKey.ROUTING_KEY_VALUE_NEW, ()=> {
                    DbValue.find({
                        nodeId: "nodeid2",
                        deviceId: "deviceid",
                    }).then(function (d) {
                        expect(d.length).to.equal(6);
                        expect(d.find((elem)=>elem.value.value == "test2")).to.be.not.undefined;
                        done();
                    }).catch(debug);
                });


            DummyAmqpChannel.publish(
                AmqpExchanges.MQTT_GATEWAY_EXCHANGE,
                MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY,
                new Buffer(JSON.stringify({
                    nodeId: "nodeid2",
                    deviceId: "deviceid",
                    message: {value: "test2"}
                })));
        });


    });
});