import { State } from "./i-state";
import { OperationState } from "./c-operation-state";

import * as debugFn from "debug";

const debug = debugFn("c-device-registration.ts");

export class Device {
    uuid: string;
    type: string;
}

export class RegistrationState implements State {

    public device: Device;

    getNextState(): State {
        if (this.device != undefined) {
            return new OperationState(this);
        } else {
            return this;
        }
    }

    processMessage(messageJson: string): void {
        try {
            const message: Device = JSON.parse(messageJson);
            this.device = message;
        } catch (e) {
            debug("got error: " + e);
        }
    }

    getDeviceId(): string {
        if (this.device) {
            return this.device.uuid;
        } else {
            return undefined;
        }
    }

    getMessage(): string {
        return undefined;
    }

    getNumMessages(): number {
        return 0;
    }
}
