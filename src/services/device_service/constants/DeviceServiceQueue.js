class DeviceServiceQueue {
    static get mainQueue() {
        return "dr.device";
    }

    static get deviceConnectedQueue(){
        return "dr.device.connect";
    }

    static get deviceReconnectedQueue(){
        return "dr.device.update";
    }

    static get deviceRpcGetQueue() {
        return "dr.device.rpc.get";
    }

    static get deviceRpcSetQueue() {
        return "dr.device.rpc.set";
    }

    static createQueues(channel) {
        channel.assertQueue(DeviceServiceQueue.mainQueue, {exclusive: false, durable: true});
        channel.assertQueue(DeviceServiceQueue.deviceConnectedQueue, {exclusive: false, durable: true});
        channel.assertQueue(DeviceServiceQueue.deviceReconnectedQueue, {exclusive: false, durable: true});
        channel.assertQueue(DeviceServiceQueue.deviceRpcGetQueue, {exclusive: false, durable: true});
        channel.assertQueue(DeviceServiceQueue.deviceRpcSetQueue, {exclusive: false, durable: true});
    }
}
module.exports = DeviceServiceQueue;