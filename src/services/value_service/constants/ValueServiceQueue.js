class ValueServiceQueue {
    static get mainQueue() {
        return "dr.value";
    }

    static get newValueQueue() {
        return "dr.value.new";
    }

}
module.exports = ValueServiceQueue;