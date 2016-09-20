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

// Require Constants
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const ValueServiceRoutingKey = require("../../src/services/value_service/constants/ValueServiceRoutingKey");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const ValueServiceQueue = require("../../src/services/value_service/constants/ValueServiceQueue");

// Require Helper
const AmqpHelper = require("../../src/helper/AmqpHelper");

// Require MongoDb model
const DbValue = require("../../src/services/value_service/db/Value");

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

        beforeEach(function () {
            "use strict";
            // clear all values
            return DbValue.find({}).remove().exec();
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
    });
});