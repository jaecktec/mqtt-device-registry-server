/**
 * Created by const on 06.09.2016.
 */
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

module.exports = mongoose.model('Value', new Schema({
    nodeId: String,
    deviceId: String,
    created: Date,
    value: Object
}));