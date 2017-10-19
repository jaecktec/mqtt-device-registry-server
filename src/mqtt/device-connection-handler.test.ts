import { mock, stub, createStubInstance, spy, spyCall } from "sinon";

import { assert } from "chai";
import * as mqtt from "mqtt";
import { DeviceConnectionHandler, DeviceConnectionEvent } from "./device-connection-handler";
import { DeviceConnection } from "./device-connection/device-connection";
import {
    MQTT_TOPIC_REGISTER,
    MQTT_TOPIC_UNREGISTER,
    MQTT_TOPIC_VALUE_SET,
    MQTT_TOPIC_VALUE_UPDATE,
    MQTT_TOPIC_REGISTER_REFRESH
} from "./device-connection/mqtt-topics";

const MESSAGE_DEVICE_REGISTER_1 = JSON.stringify({uuid: "unit_test_uuid_1", unit: "unit_test_unit", sensor: 1});

describe("NodeConnectionHandlerTest", () => {

    let connectionHandler: DeviceConnectionHandler;
    let client: mqtt.Client;

    beforeEach(() => {
        client = mock(mqtt.Client);
        client.subscribe = () => this; // mock them old fashioned way
        client.on = () => this; // mock them old fashioned way, maybe relpace with more elegant solution
        client.publish = () => this;
        connectionHandler = new DeviceConnectionHandler();
    });

    it("subscribed to correct topics", () => {
        const topics = ["dr/register/+", "dr/device/+/+", "dr/unregister/+"];

        // create spy functions
        const spySubscribe = spy();
        client.subscribe = spySubscribe;

        connectionHandler.listen(client);
        assert(spySubscribe.calledOnce);
        assert.deepEqual(topics.sort(), spySubscribe.getCall(0).args[0].sort());
    });

    it("when register message is sent, expect one device being registered", (done) => {

        client.on = (event: string, cb) => {
            assert.equal(event, "message");
            cb(MQTT_TOPIC_REGISTER.topic.replace("+", "nodeId"), MESSAGE_DEVICE_REGISTER_1);
            assert.equal(connectionHandler.getConnections().length, 1);
            done();
            return this;
        };
        connectionHandler.listen(client);
    });

    it("when device is registered and unregister message is called, there are no devices left", (done) => {
        client.on = (event: string, cb) => {
            assert.equal(event, "message");
            cb(MQTT_TOPIC_REGISTER.topic.replace("+", "nodeId"), MESSAGE_DEVICE_REGISTER_1);
            assert.equal(connectionHandler.getConnections().length, 1);
            cb(MQTT_TOPIC_UNREGISTER.topic.replace("+", "nodeId"), "");
            assert.equal(connectionHandler.getConnections().length, 0);
            done();
            return this;
        };
        connectionHandler.listen(client);
    });

    it("when device is registered and value message is called we have a message equal to the sent in the buffer", (done) => {
        client.on = (event: string, cb) => {

            const valueMessage = {value: "unit_test_value"};

            assert.equal(event, "message");
            cb(MQTT_TOPIC_REGISTER.topic.replace("+", "nodeId"), MESSAGE_DEVICE_REGISTER_1);
            cb(MQTT_TOPIC_VALUE_UPDATE.topic.replace("+", "nodeId").replace("+", "unit_test_uuid_1"), JSON.stringify(valueMessage));

            assert.equal(connectionHandler.getConnections().length, 1);

            const connection = connectionHandler.getConnections()[0];
            assert.exists(connection);
            assert.equal(connection.getNumMessages(), 1);
            const message = connection.getMessage();
            // expect when we get the mssage from buffer that there are no new messages left
            assert.equal(connection.getNumMessages(), 0);
            assert.deepEqual(message, valueMessage);
            done();
            return this;
        };
        connectionHandler.listen(client);
    });

    it("callback wiht event CONNECT and new connection is called when connect message is sent", (done) => {
        connectionHandler.setDeviceEventHandler((eventType: DeviceConnectionEvent, involvedConnections: Array<DeviceConnection>) => {
            assert.equal(eventType, DeviceConnectionEvent.CONNECT);
            assert.equal(involvedConnections.length, 1);
            assert.equal(involvedConnections[0].getNodeId(), "nodeId");
            assert.equal(involvedConnections[0].getDeviceId(), "unit_test_uuid_1");
            done();
        });
        client.on = (event: string, cb) => {
            assert.equal(event, "message");
            cb(MQTT_TOPIC_REGISTER.topic.replace("+", "nodeId"), MESSAGE_DEVICE_REGISTER_1);
            return this;
        };
        connectionHandler.listen(client);
    });

    it("callback with event VALUE and message is present on connection", (done) => {
        connectionHandler.setDeviceEventHandler((eventType: DeviceConnectionEvent, involvedConnections: Array<DeviceConnection>) => {
            assert.equal(eventType, DeviceConnectionEvent.CONNECT);
            assert.equal(involvedConnections.length, 1);
            assert.equal(involvedConnections[0].getNodeId(), "nodeId");
            assert.equal(involvedConnections[0].getDeviceId(), "unit_test_uuid_1");
            done();
        });
        client.on = (event: string, cb) => {
            assert.equal(event, "message");
            cb(MQTT_TOPIC_REGISTER.topic.replace("+", "nodeId"), MESSAGE_DEVICE_REGISTER_1);
            return this;
        };
        connectionHandler.listen(client);
    });

    it("handler ignors update request", (done) => {
        client.on = (event: string, cb) => {
            assert.equal(event, "message");
            assert.equal(connectionHandler.getConnections().length, 0);
            cb(MQTT_TOPIC_REGISTER_REFRESH.topic, "");
            assert.equal(connectionHandler.getConnections().length, 0);
            done();
            return this;
        };
        connectionHandler.listen(client);
    });

});
