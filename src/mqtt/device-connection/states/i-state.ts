export interface State {
    getNextState(): State;
    processMessage(messageJson: string): void;
    getDeviceId(): string;
    getMessage(): any;
    getNumMessages(): number;
}