import { State } from "./i-state";
import { RegistrationState } from "./c-registration-state";


export class OperationState {

    messageBuffer = new Array<any>();

    constructor(public deviceRegistrationState: RegistrationState) {

    }

    getNextState(): State {
        return this;
    }

    processMessage(messageJson: string): void {
        this.messageBuffer.push(JSON.parse(messageJson));
    }

    getDeviceId(): string {
        return this.deviceRegistrationState.getDeviceId();
    }

    getMessage(): any {
        return this.messageBuffer.pop();
    }

    getNumMessages(): number {
        return this.messageBuffer.length;
    }
}
