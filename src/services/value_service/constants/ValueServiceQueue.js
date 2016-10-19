class ValueServiceQueue {
    static get mainQueue() {
        return "dr.value";
    }

    static get newValueQueue() {
        return "dr.value.new";
    }

    static get valueRpcQueue() {
        return "dr.value.rpc"
    }

}
module.exports = ValueServiceQueue;