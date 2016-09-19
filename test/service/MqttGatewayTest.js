/**
 * Created by Constantin Jaeck on 18.09.2016.
 */
var mockrequire = require('mock-require');
const debug = require('debug')('mqtt-device-registry.test.MqttGatewayTest');
const chai = require("chai");
chai.use(require('chai-datetime'));
const expect = chai.expect;

// Mocking AMQP
const DummyAmqp = require("../DummyAmqp/DummyAmqp");
const DummyAmqpChannel = require("../DummyAmqp/DummyAmqpChannel");
const DummyAmqpConnection = require("../DummyAmqp/DummyAmqpConnection");
mockrequire('amqplib', DummyAmqp);

// Mocking MQTT
const DummyMqtt = require("../DummyMqtt/DummyMqtt");
const DummyMqttClient = require("../DummyMqtt/DummyMqttClient");
mockrequire("mqtt", DummyMqtt);

const AmqpHelper = require("../../src/helper/AmqpHelper");
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const MqttGatewayBrokerTopics = require("../../src/services/mqtt_gateway/constants/MqttGatewayBrokerTopics");
const MqttGateway = require("../../src/services/mqtt_gateway/MqttGateway");

describe("MqttGatewayTest", function () {
    before(function (done) {
        DummyMqttClient.subscribeOnce(MqttGatewayBrokerTopics.TOPIC_UPDATE_REGISTER, function () {
            "use strict";
            done();
        });
        MqttGateway.start("", "");
    });

    beforeEach(function (done) {
        DummyAmqpChannel.clear("test");
        done();
    });

    var DEVICE_REGISTER_MSG = '{"unit":"unit","sensor":1,"uuid":"deviceid"}';
    it("Register message", function (done) {
        DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY);
        DummyAmqpChannel.consume("test", function (msgBuffer) {
            let msg = AmqpHelper.bufferToObj(msgBuffer.content);
            expect(msg.nodeId).to.equal("nodeid");
            expect(msg.id).to.equal("deviceid");
            expect(msg.unit).to.equal("unit");
            expect(msg.sensor).to.equal(true);
            done();
        });
        DummyMqttClient.publish(MqttGatewayBrokerTopics.TOPIC_REGISTER.replace("+", "nodeid"), DEVICE_REGISTER_MSG);
    });

    var DEVICE_VALUE_MSG = '{"value": "test"}';
    it("Value message", function (done) {
        DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY);
        DummyAmqpChannel.consume("test", function (msgBuffer) {
            let msg = AmqpHelper.bufferToObj(msgBuffer.content);
            expect(msg.nodeId).to.equal("nodeid");
            expect(msg.deviceId).to.equal("deviceid");
            expect(msg.message.value).to.equal("test");
            done();
        });
        DummyMqttClient.publish(MqttGatewayBrokerTopics.TOPIC_DEVICE.replace("+", "nodeid").replace("+", "deviceid"), DEVICE_VALUE_MSG);
    });

    it("Node disconnected", function (done) {
        DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.NODE_ROUTING_KEY);
        DummyAmqpChannel.consume("test", function (msgBuffer) {
            let msg = AmqpHelper.bufferToObj(msgBuffer.content);
            expect(msg.nodeId).to.equal("nodeid");
            done();
        });
        DummyMqttClient.publish(MqttGatewayBrokerTopics.TOPIC_UNREGISTER.replace("+", "nodeid"));
    });

});