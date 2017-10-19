import { State } from "./i-state";

export class DisconnectedState implements State {
    constructor(public previousState: State) {
    }

    getNextState(): State {
        return this;
    }

    processMessage(messageJson: string): void {
    }

    getDeviceId(): string {
        return this.previousState.getDeviceId();
    }

    getMessage(): string {
        return this.previousState.getMessage();
    }

    getNumMessages(): number {
        return this.previousState.getNumMessages();
    }
}
