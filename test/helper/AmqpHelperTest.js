const AmqpHelper = require("../../src/helper/AmqpHelper");
var expect = require('chai').expect;
var assert = require("assert");

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
})