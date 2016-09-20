const mockrequire = require('mock-require');
const AmqpHelper = require("../../src/helper/AmqpHelper");
const expect = require('chai').expect;
const assert = require("assert");
var debug = require('debug')('mqtt-device-registry.test.AmqpHelperTest');

// Mocking AMQP
const DummyAmqp = require("../DummyAmqp/DummyAmqp");
const DummyAmqpChannel = require("../DummyAmqp/DummyAmqpChannel");
const DummyAmqpConnection = require("../DummyAmqp/DummyAmqpConnection");
mockrequire('amqplib', DummyAmqp);

describe('AmqpHelperTest', function () {

    it('#handleAck - Success', function (done) {
        AmqpHelper.handleAck({msg: "test"}, {
            ack: function (msg) {
                "use strict";
                expect(msg.msg).to.equal("test");
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
        AmqpHelper.handleAck({msg: "test"}, {
            ack: function () {
                "use strict";
                assert.fail();
                done();
            },
            reject: function (msg) {
                expect(msg.msg).to.equal("test");
                done();
            }
        }, function () {
            return new Promise((re, rej)=> rej())
        })
    });

    it('rpc test client to server and back', function (done) {
        DummyAmqpChannel.bindQueue("test-queue", "test-exchange", "test-routing-key");
        DummyAmqpChannel.consume("test-queue", (msgBuffer)=> {
            let msg = AmqpHelper.bufferToObj(msgBuffer.content);

            expect(msg.correlationId).to.be.not.empty;
            expect(msg.respondToExchange).to.be.not.empty;
            expect(msg.content.hello).to.equal("hello");
            AmqpHelper.rpcRespond({world: "world"}, msg, DummyAmqpChannel);
        });

        AmqpHelper.rpcRequest({hello: "hello"}, "test-exchange", "test-routing-key", DummyAmqpChannel).then((response)=> {
            expect(response.world).to.equal("world");
            done();
        }).catch(debug);
    });
});