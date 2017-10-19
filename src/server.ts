import * as mqtt from 'mqtt';

import * as express from 'express';
import * as http from 'http';
import * as SocketIO from 'socket.io';

import * as debugFn from 'debug';

const debug = debugFn('server.ts');

import { DeviceConnectionEvent, DeviceConnectionHandler } from './mqtt/device-connection-handler';

import { DatabaseHandler, DatabaseTables } from './persistence/database';
import { PersistenceService } from './persistence/persistence-service';

export class Server {
    private connectionHandler: DeviceConnectionHandler;
    private mqttClient: mqtt.Client;

    private tables: DatabaseTables;
    private persistenceService;


    public static bootstrap(mqttUrl: String = 'mqtt://localhost', deviceEventHandler: DeviceEventHandler = {
        onConnect: () => {
        },
        onDisconnect: () => {
        },
        onMessage: () => {
        }
    }) {
        return new Server(mqttUrl, deviceEventHandler);
    }

    constructor(private mqttUrl: String, private deviceEventHandler: DeviceEventHandler) {
        new DatabaseHandler().start().then((databaseTables: DatabaseTables) => {
            this.tables = databaseTables;
            this.persistenceService = new PersistenceService(this.tables);

            this.createMqttClient();
            this.listen();
        });
    }

    private createMqttClient() {
        this.mqttClient = mqtt.connect(this.mqttUrl, {
            clientId: 'MqttDeviceRegistryGateway'
        });
    }

    private listenMqtt() {
        this.connectionHandler = new DeviceConnectionHandler();
        this.connectionHandler.setDeviceEventHandler((event, connections) => {
            if (event == DeviceConnectionEvent.CONNECT) {
                this.persistenceService.handleNewDevices(connections);
                connections.forEach(c => {
                    this.deviceEventHandler.onConnect(c.getNodeId(), c.getDeviceId());
                });
            } else if (event == DeviceConnectionEvent.DISCONNECT) {
                this.persistenceService.handleNodeDisconnect(connections);
                connections.forEach(c => {
                    this.deviceEventHandler.onDisconnect(c.getNodeId(), c.getDeviceId());
                });
            }
            this.persistenceService.handleDeviceValue(connections);
            connections.forEach(c => {
                const numMessages = c.getNumMessages();
                for (let idx = 0; idx < numMessages; idx++) {
                    this.deviceEventHandler.onMessage(c.getNodeId(), c.getDeviceId(), c.getMessage());
                }
            });
        });
        this.connectionHandler.listen(this.mqttClient);
    }

    private listen(): void {
        this.listenMqtt();
    }
}

export interface DeviceEventHandler {
    onConnect(nodeId: String, deviceId: String);

    onDisconnect(nodeId: String, deviceId: String);

    onMessage(nodeId: String, deviceId: String, value: any);
}