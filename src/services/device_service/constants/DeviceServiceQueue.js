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

    static get deviceRpcQueue() {
        return "dr.device.rpc.get"
    }

    static createQueues(channel) {
        channel.assertQueue(DeviceServiceQueue.mainQueue, {exclusive: false, durable: true});
        channel.assertQueue(DeviceServiceQueue.deviceConnectedQueue, {exclusive: false, durable: true});
        channel.assertQueue(DeviceServiceQueue.deviceReconnectedQueue, {exclusive: false, durable: true});
        channel.assertQueue(DeviceServiceQueue.deviceRpcQueue, {exclusive: false, durable: true});
    }
}
module.exports = DeviceServiceQueue;