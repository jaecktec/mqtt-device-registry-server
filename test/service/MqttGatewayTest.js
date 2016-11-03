/**
 * Created by Constantin Jaeck on 18.09.2016.
 */
var mockrequire = require('mock-require');
const debug = require('debug')('mqtt-device-registry.test.MqttGatewayTest');
const chai = require("chai");
chai.use(require('chai-datetime'));
const expect = chai.expect;

const amqp = require('amqplib');
const co = require("co");
const uuid = require('uuid');

// Mocking MQTT
const DummyMqtt = require("../DummyMqtt/DummyMqtt");
const DummyMqttClient = require("../DummyMqtt/DummyMqttClient");
mockrequire("mqtt", DummyMqtt);

const AmqpHelper = require("../../src/helper/AmqpHelper");
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const MqttGatewayBrokerTopics = require("../../src/services/mqtt_gateway/constants/MqttGatewayBrokerTopics");
const MqttGateway = require("../../src/services/mqtt_gateway/MqttGateway");

const AmqpTestHelper = require("../AmqpTestHelper/AmqpTestHelper");

describe("MqttGatewayTest", function () {
    before(function (done) {
        MqttGateway.start(process.env.RABBIT_MQ_URI, "").then(()=> {
                "use strict";
                DummyMqttClient.subscribeOnce(MqttGatewayBrokerTopics.TOPIC_UPDATE_REGISTER, () => {
                    "use strict";
                    done()
                });
                MqttGateway.updateRegistrations();
            }
        );
    });

    let connection;
    let channel;

    beforeEach(function (done) {
        co(function *() {
            connection = yield amqp.connect(process.env.RABBIT_MQ_URI);
            channel = yield connection.createChannel();
        }).then(()=>done()).catch(console.log);
    });

    const DEVICE_REGISTER_MSG = '{"unit":"unit","sensor":1,"uuid":"deviceid"}';
    it("Register message", function (done) {

        AmqpTestHelper.createQueueAndBindOnce(
            channel,
            ()=> {
                DummyMqttClient.publish(MqttGatewayBrokerTopics.TOPIC_REGISTER.replace("+", "nodeid"), DEVICE_REGISTER_MSG);
            },
            AmqpExchanges.MQTT_GATEWAY_EXCHANGE,
            MqttGatewayRoutingKey.DEVICE_ROUTING_KEY
        ).then((msg)=> {
            expect(msg.nodeId).to.equal("nodeid");
            expect(msg.id).to.equal("deviceid");
            expect(msg.unit).to.equal("unit");
            expect(msg.sensor).to.equal(true);
            done();
        });
    });


    const DEVICE_VALUE_MSG = '{"value": "test"}';
    it("Value Message", function (done) {
        AmqpTestHelper.createQueueAndBindOnce(
            channel,
            ()=> {
                DummyMqttClient.publish(MqttGatewayBrokerTopics.TOPIC_DEVICE.replace("+", "nodeid").replace("+", "deviceid"), DEVICE_VALUE_MSG);
            },
            AmqpExchanges.MQTT_GATEWAY_EXCHANGE,
            MqttGatewayRoutingKey.DEVICE_VALUE_ROUTING_KEY
        ).then((msg)=> {
            expect(msg.nodeId).to.equal("nodeid");
            expect(msg.deviceId).to.equal("deviceid");
            expect(msg.message.value).to.equal("test");
            done();
        });
    });


    it("Node disconnected", function (done) {
        AmqpTestHelper.createQueueAndBindOnce(
            channel,
            ()=> {
                DummyMqttClient.publish(MqttGatewayBrokerTopics.TOPIC_UNREGISTER.replace("+", "nodeid"));
            },
            AmqpExchanges.MQTT_GATEWAY_EXCHANGE,
            MqttGatewayRoutingKey.NODE_ROUTING_KEY
        ).then((msg)=> {
            expect(msg.nodeId).to.equal("nodeid");
            done();
        });
    });
});