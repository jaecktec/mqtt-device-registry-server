import { RegistrationState } from "./states/c-registration-state";
import { OperationState } from "./states/c-operation-state";
import { DisconnectedState } from "./states/c-disconnected-state";
import { State } from "./states/i-state";
import * as debugFn from "debug";

const debug = debugFn("connection/c-node-connection.ts");

export enum DeviceConnectionState {
    CONNECTING,
    OPERATION,
    DISCONNECTED,
    UNKNOWN
}

export class DeviceConnection {

    protected currentState: State;
    protected callbackFn: (p: DeviceConnectionState) => any;

    constructor(private nodeId: string) {
        this.currentState = new RegistrationState();
    }

    public handleMessage(message: string): void {
        this.currentState.processMessage(message);
        this.currentState = this.currentState.getNextState();
    }

    public disconnect(): void {
        this.currentState = new DisconnectedState(this.currentState);
    }

    public getState(): DeviceConnectionState {
        if (this.currentState instanceof RegistrationState) {
            return DeviceConnectionState.CONNECTING;
        } else if (this.currentState instanceof OperationState) {
            return DeviceConnectionState.OPERATION;
        } else if (this.currentState instanceof DisconnectedState) {
            return DeviceConnectionState.DISCONNECTED;
        } else {
            debug("UNKNOWN State should not be happening, pls check here");
            return DeviceConnectionState.UNKNOWN;
        }
    }

    public getNodeId(): string {
        return this.nodeId;
    }

    public getDeviceId(): string {
        return this.currentState.getDeviceId();
    }

    public getMessage(): any {
        return this.currentState.getMessage();
    }

    public getNumMessages(): number {
        return this.currentState.getNumMessages();
    }
}
