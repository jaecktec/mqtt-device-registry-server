import * as debugFn from "debug";
import * as mqtt from "mqtt";
import { DeviceConnection } from "./device-connection/device-connection";
// import { Packet } from '../node_modules/mqtt/types'
import {
    MQTT_TOPIC_REGISTER, MQTT_TOPIC_REGISTER_REFRESH, MQTT_TOPIC_UNREGISTER,
    MQTT_TOPIC_VALUE_UPDATE
} from "./device-connection/mqtt-topics";

const debug = debugFn("device-connection-handler.ts");

type DeviceEventHandler = (eventType: DeviceConnectionEvent, involvedConnections: Array<DeviceConnection>, allConnections: Array<DeviceConnection>) => void;


export enum DeviceConnectionEvent {
    CONNECT, DISCONNECT, VALUE
}

export class DeviceConnectionHandler {

    private connections: Array<DeviceConnection> = [];
    private deviceEventHandler: DeviceEventHandler = () => {
    }

    constructor() {

    }

    public listen(mqttClient: mqtt.Client): void {
        mqttClient.subscribe([MQTT_TOPIC_REGISTER.topic, MQTT_TOPIC_UNREGISTER.topic, MQTT_TOPIC_VALUE_UPDATE.topic]);

        mqttClient.on("message", (topic: string, payload: Buffer) => {
            const involvedConnections = new Array<DeviceConnection>();
            let connectionEvent: DeviceConnectionEvent;
            if (MQTT_TOPIC_REGISTER.exec(topic)) {
                connectionEvent = DeviceConnectionEvent.CONNECT;
                const mqttValues = MQTT_TOPIC_REGISTER.exec(topic);
                if (mqttValues.nodeId === "update") return;
                debug("new connection from " + mqttValues.nodeId);
                const connection = new DeviceConnection(mqttValues.nodeId);
                this.connections.push(connection);
                connection.handleMessage(this.bufferToString(payload));
                involvedConnections.push(connection);
            } else if (MQTT_TOPIC_UNREGISTER.exec(topic)) {
                connectionEvent = DeviceConnectionEvent.DISCONNECT;
                const mqttValues = MQTT_TOPIC_UNREGISTER.exec(topic);
                this.connections
                    .filter(c => c.getNodeId() == mqttValues.nodeId)
                    .forEach(c => {
                        c.disconnect();
                        involvedConnections.push(c);
                    });
                this.connections = this.connections
                    .filter(c => c.getNodeId() != mqttValues.nodeId);
            } else if (MQTT_TOPIC_VALUE_UPDATE.exec(topic)) {
                connectionEvent = DeviceConnectionEvent.VALUE;
                const mqttValues = MQTT_TOPIC_VALUE_UPDATE.exec(topic);
                debug("new message from " + mqttValues.nodeId + " deviceId=" + mqttValues.deviceId + " value=" + this.bufferToString(payload));

                const connections = this.connections
                    .filter(c => c.getNodeId() == mqttValues.nodeId)
                    .filter(c => c.getDeviceId() == mqttValues.deviceId);
                connections
                    .forEach(c => c.handleMessage(this.bufferToString(payload)));
                connections
                    .forEach(c => involvedConnections.push(c));
            }
            this.deviceEventHandler(connectionEvent, involvedConnections, this.connections);
        });

        debug(mqttClient.connected);
        mqttClient.publish(MQTT_TOPIC_REGISTER_REFRESH.topic, "");
    }

    public setDeviceEventHandler(deviceEventHandler: DeviceEventHandler) {
        this.deviceEventHandler = deviceEventHandler;
    }

    public getConnections(): Array<DeviceConnection> {
        return this.connections;
    }

    private bufferToString(buffer: Buffer): string {
        return buffer.toString("UTF-8").replace(/\uFFFD/g, "").replace("\u0000", "");
    }


}
