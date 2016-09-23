class NodeServiceQueue {
    static get mainQueue() {
        return "dr.node";
    }

    static get nodeConnectedQueue(){
        return "dr.node.connect";
    }

    static get nodeReconnectedQueue(){
        return "dr.node.update";
    }

    static get nodeDisconnectedQueue(){
        return "dr.node.disconnect";
    }

    static get nodeRpcQueue() {
        return "dr.node.rpc";
    }
}
module.exports = NodeServiceQueue;