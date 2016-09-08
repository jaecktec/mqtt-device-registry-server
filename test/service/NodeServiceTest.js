/**
 * Created by const on 06.09.2016.
 */
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
const NodeService = require("../../src/services/node_service/NodeService");

// Require Constants
const AmqpExchanges = require("../../src/constants/AmqpExchanges");
const NodeServiceRoutingKey = require("../../src/services/node_service/constants/NodeServiceRoutingKey");
const MqttGatewayRoutingKey = require("../../src/services/mqtt_gateway/constants/MqttGatewayRoutingKey");
const DeviceServiceRoutingKey = require("../../src/services/device_service/constants/DeviceServiceRoutingKey");
const DeviceServiceQueue = require("../../src/services/device_service/constants/DeviceServiceQueue");

// Require Helper
const AmqpHelper = require("../../src/helper/AmqpHelper");

// Require MongoDb model
const DbNode = require("../../src/services/node_service/db/Node");

describe('NodeServiceTest', function () {
    before(function () {
        "use strict";
        return NodeService.start(MONGODB_URI_TEST, "");
    });
})