/**
 * Created by Constantin Jaeck on 19.09.2016.
 */
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

const app = require("./ValueService");
const assert = require("assert");

const RABBIT_MQ_URI = process.env.RABBIT_MQ_URI;

assert(RABBIT_MQ_URI, "RABBIT_MQ_URI Environment variable missing");

app.start(RABBIT_MQ_URI).catch((err) => console.error(err.stack));