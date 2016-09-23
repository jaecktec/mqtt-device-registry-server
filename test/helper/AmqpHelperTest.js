const mockrequire = require('mock-require');
const AmqpHelper = require("../../src/helper/AmqpHelper");
const expect = require('chai').expect;
const assert = require("assert");
var debug = require('debug')('mqtt-device-registry.test.AmqpHelperTest');

// Mocking AMQP
const DummyAmqp = require("../DummyAmqp/DummyAmqp");
const DummyAmqpChannel = require("../DummyAmqp/DummyAmqpChannel");
const DummyAmqpConnection = require("../DummyAmqp/DummyAmqpConnection");
//mockrequire('amqplib', DummyAmqp);

const amqp = require('amqplib');
const co = require("co");
const AmqpExchanges = require("../../src/constants/AmqpExchanges");

describe('AmqpHelperTest', function () {

    let connection;
    let channel;
    let exchange;

    before(function (done) {
        co(function*() {
            connection = yield amqp.connect(process.env.RABBIT_MQ_URI);
            channel = yield connection.createChannel();
            exchange = yield channel.assertExchange("test-exchange", 'direct', {durable: false, autoDelete: true});
            exchange = yield channel.assertExchange(AmqpExchanges.RPC_RETURN_EXCHANGE, 'direct', {});
            debug("created amqp");
        }).then(()=>done()).catch(console.log);
    });

    it('#handleAck - Success', function (done) {
        AmqpHelper.handleAck({content: AmqpHelper.objToBuffer({msg: "test"})}, {
            ack: function (msg) {
                "use strict";
                expect(AmqpHelper.bufferToObj(msg.content).msg).to.equal("test");
                done();
            },
            reject: function () {
                assert.fail();
                done();
            }
        }, function () {
            return new Promise((re)=> re())
        })
    });

    it('#handleAck - Fail', function (done) {
        AmqpHelper.handleAck({content: AmqpHelper.objToBuffer({msg: "test"})}, {
            ack: function () {
                "use strict";
                assert.fail();
                done();
            },
            reject: function (msg) {
                expect(AmqpHelper.bufferToObj(msg.content).msg).to.equal("test");
                done();
            }
        }, function () {
            return new Promise((re, rej)=> rej())
        })
    });

    it('rpc test client to server and back', function (done) {
        channel.assertQueue(null, {exclusive: true, autoDelete: true}).then((queue)=> {
            channel.bindQueue(queue.queue, "test-exchange", "test-routing-key");
            channel.consume(queue.queue, (msgBuffer)=> {
                let msg = AmqpHelper.bufferToObj(msgBuffer.content);
                expect(msg.correlationId).to.be.not.empty;
                expect(msg.respondToExchange).to.be.not.empty;
                expect(msg.content.hello).to.equal("hello");
                AmqpHelper.rpcRespond({world: "world"}, msg, channel);
            });
        });
        AmqpHelper.rpcRequest({hello: "hello"}, "test-exchange", "test-routing-key", channel).then((response)=> {
            expect(response.world).to.equal("world");
            done();
        }).catch(debug);
    });
});