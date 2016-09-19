/**
 * Created by Constantin Jaeck on 19.09.2016.
 */
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const app = require("./ValueService");
const assert = require("assert");

const RABBIT_MQ_URI = process.env.RABBIT_MQ_URI;
const MONGO_DB_URI = process.env.MONGODB_URI;

assert(RABBIT_MQ_URI, "RABBIT_MQ_URI Environment variable missing");
assert(MONGO_DB_URI, "MONGO_DB_URI Environment variable missing");

app.start(MONGO_DB_URI, RABBIT_MQ_URI).catch((err) => console.error(err.stack));