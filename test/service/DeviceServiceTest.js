var mockrequire = require('mock-require');
const debug = require('debug')('mqtt-device-registry.test.DeviceServiceTest');
var expect = require("chai").expect;


const MONGODB_URI_TEST = "mongodb://localhost:32774/device_registry_test";

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
        return DeviceService.start(MONGODB_URI_TEST, "");
    });

    beforeEach(function () {
        DummyAmqpChannel.clear("test");
        return DbDevice.find({nodeId: "nodeid", id: "deviceid"}).remove().exec();
    });

    it('device message - device does not exist', function (done) {
        "use strict";
        DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT);
        DummyAmqpChannel.consume("test", (msgBuffer)=> {
            let msg = AmqpHelper.bufferToObj(msgBuffer.content);
            expect(msg.nodeId).to.equal("nodeid");
            expect(msg.id).to.equal("deviceid");
            expect(msg.unit).to.equal("unit");
            expect(msg.sensor).to.equal("sensor");
            done();
        });
        DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
            nodeId: "nodeid",
            id: "deviceid",
            unit: "unit",
            sensor: "sensor"
        })));
    });

    it('device message - device does exist', function (done) {
        "use strict";

        before(function () {
            return new DbDevice({
                nodeId: "nodeid",
                id: "deviceid",
                sensor: "sensor",
                unit: "unit"
            }).save();
        });

        DummyAmqpChannel.bindQueue("test", AmqpExchanges.mqttGatewayExchange, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_UPDATE);

        DummyAmqpChannel.consume("test", (msgBuffer)=> {
            let msg = AmqpHelper.bufferToObj(msgBuffer.content);
            expect(msg.nodeId).to.equal("nodeid");
            expect(msg.id).to.equal("deviceid");
            expect(msg.unit).to.equal("unit_new");
            expect(msg.sensor).to.equal("sensor_new");
            done();
        });

        DummyAmqpChannel.publish(AmqpExchanges.mqttGatewayExchange, MqttGatewayRoutingKey.DEVICE_ROUTING_KEY, new Buffer(JSON.stringify({
            nodeId: "nodeid",
            id: "deviceid",
            unit: "unit_new",
            sensor: "sensor_new"
        })));

    });

    it('device message - device does not exist - checking if created', function (done) {
        "use strict";
        DummyAmqpChannel.debugBindToAfter(DeviceServiceQueue.deviceConnectedQueue, AmqpExchanges.mqttGatewayExchange, DeviceServiceRoutingKey.ROUTING_KEY_DEVICE_CONNECT, ()=> {
            debug("Searhing...");
            DbDevice.findOne({nodeId: "nodeid", id: "deviceid"}).then((d)=> {
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

