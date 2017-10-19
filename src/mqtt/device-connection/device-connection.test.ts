import { assert } from "chai";
import { DeviceConnection, DeviceConnectionState } from "./device-connection";


const MESSAGE_DEVICE_REGISTER = JSON.stringify({uuid: "unit_test_uuid_1", unit: "unit_test_unit", sensor: 1});
const MESSAGE_VALUE = JSON.stringify({value: "unit_test_value"});

describe("NodeConnectionTest", () => {

    let NODE_ID = "nodeId";

    let connection: DeviceConnection;

    beforeEach(() => {
        this.connection = new DeviceConnection(NODE_ID);
    });

    it("check if nodeId is correctly returned", () => {
        assert.equal(this.connection.getNodeId(), NODE_ID);
    });

    it("connection is in state 'CONNECTION' at start and everything is initial", () => {
        assert.equal(this.connection.getState(), DeviceConnectionState.CONNECTING)
        assert.equal(this.connection.getNodeId(), NODE_ID);
        assert.isUndefined(this.connection.getDeviceId());
        assert.isUndefined(this.connection.getMessage());
        assert.equal(this.connection.getNumMessages(), 0);
    });

    it("connection stays in state 'CONNECTION' when message is not valid", () => {
        this.connection.handleMessage("");
        assert.equal(this.connection.getState(), DeviceConnectionState.CONNECTING);
    });


    it("connection is in state operation when register message is processed", () => {
        this.connection.handleMessage(MESSAGE_DEVICE_REGISTER);
        assert.equal(this.connection.getState(), DeviceConnectionState.OPERATION);
        assert.equal(this.connection.getDeviceId(), "unit_test_uuid_1");
    });

    it("connection goes to state disconnected when disconnect is called", () => {
        this.connection.disconnect();
        this.connection.handleMessage("");
        assert.equal(this.connection.getState(), DeviceConnectionState.DISCONNECTED);
        assert.equal(this.connection.getNodeId(), NODE_ID);
    });

    it("should have one message in inbox when message is published", () => {
        this.connection.handleMessage(MESSAGE_DEVICE_REGISTER);
        this.connection.handleMessage(MESSAGE_VALUE);
        assert.equal(this.connection.getNumMessages(), 1);
        const message = this.connection.getMessage();
        assert.isNotNull(message, "message is not defined");
    });

    it("not processed message not lost when disconnected", () => {
        this.connection.handleMessage(MESSAGE_DEVICE_REGISTER);
        this.connection.handleMessage(MESSAGE_VALUE);
        this.connection.disconnect();
        this.connection.handleMessage("");
        assert.equal(this.connection.getState(), DeviceConnectionState.DISCONNECTED);
        assert.equal(this.connection.getNumMessages(), 1);
        this.connection.handleMessage(MESSAGE_VALUE);
        assert.equal(this.connection.getDeviceId(), "unit_test_uuid_1");
        assert.equal(this.connection.getNumMessages(), 1);
        const message = this.connection.getMessage();
        assert.isNotNull(message, "message is not defined");
    });

    it("put connection into unknown state, that shoud theoreticly never happen irl", () => {
        this.connection.currentState = undefined;
        assert.equal(this.connection.getState(), DeviceConnectionState.UNKNOWN);
    });

});