class NodeServiceQueue {
    static get mainQueue() {
        return "dr.device";
    }

    static get deviceConnectedQueue(){
        return "dr.device.connect";
    }

    static get deviceReconnectedQueue(){
        return "dr.device.update";
    }

}
module.exports = NodeServiceQueue;