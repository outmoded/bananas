'use strict';

// Load modules

const Bananas = require('../');
const Code = require('code');
const Hapi = require('hapi');
const Lab = require('lab');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const lab = exports.lab = Lab.script();
const describe = lab.describe;
const it = lab.it;
const expect = Code.expect;


describe('Bananas', () => {

    it('logs error event', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();

            server.route({
                path: '/',
                method: 'GET',
                handler: function (request, reply) {

                    request.server.log('server event');
                    throw new Error('boom');
                }
            });

            const updates = [];
            const orig = Wreck.post;
            Wreck.post = function (uri, options, ignore) {

                updates.push({ uri, options });
            };

            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res) => {

                    setTimeout(() => {

                        const messages = updates[0].options.payload.split('\n');
                        expect(messages.length).to.equal(3);
                        Wreck.post = orig;

                        server.stop((err) => {

                            expect(err).to.not.exist();
                            done();
                        });
                    }, 200);
                });
            });
        });
    });

    it('logs valid event', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();

            server.route({
                path: '/',
                method: 'GET',
                handler: function (request, reply) {

                    return reply('hello');
                }
            });

            const updates = [];
            const orig = Wreck.post;
            Wreck.post = function (uri, options, ignore) {

                updates.push({ uri, options });
            };

            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res) => {

                    setTimeout(() => {

                        expect(updates.length).to.equal(1);
                        Wreck.post = orig;

                        server.stop((err) => {

                            expect(err).to.not.exist();
                            done();
                        });
                    }, 110);
                });
            });
        });
    });
});
