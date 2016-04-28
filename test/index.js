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

        let updates = [];
        const orig = Wreck.post;
        Wreck.post = function (uri, options, next) {

            updates = updates.concat(options.payload.split('\n'));
            return next();
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

            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res) => {

                    setTimeout(() => {

                        expect(updates.length).to.equal(4);
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

        let updates = [];
        const orig = Wreck.post;
        Wreck.post = function (uri, options, next) {

            updates = updates.concat(options.payload.split('\n'));
            return next();
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

            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res) => {

                    setTimeout(() => {

                        expect(updates.length).to.equal(2);
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

    it('logs valid event on late connection', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            root: true
        };

        let updates = [];
        const orig = Wreck.post;
        Wreck.post = function (uri, options, next) {

            updates = updates.concat(options.payload.split('\n'));
            return next();
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();

            server.connection();
            server.route({
                path: '/',
                method: 'GET',
                handler: function (request, reply) {

                    return reply('hello');
                }
            });

            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/', (res) => {

                    setTimeout(() => {

                        expect(updates.length).to.equal(2);
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
            intervalMsec: 50,
            exclude: ['/b']
        };

        let updates = [];
        const orig = Wreck.post;
        Wreck.post = function (uri, options, next) {

            updates = updates.concat(options.payload.split('\n'));
            return next();
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();

            server.route({
                path: '/a',
                method: 'GET',
                handler: function (request, reply) {

                    return reply('hello');
                }
            });

            server.route({
                path: '/b',
                method: 'GET',
                handler: function (request, reply) {

                    return reply('hello');
                }
            });

            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/a', (res1) => {

                    server.inject('/b', (res2) => {

                        setTimeout(() => {

                            expect(updates.length).to.equal(2);
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
    });

    it('filter routes with flag', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            exclude: ['/b']
        };

        let updates = [];
        const orig = Wreck.post;
        Wreck.post = function (uri, options, next) {

            updates = updates.concat(options.payload.split('\n'));
            return next();
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();

            server.route({
                path: '/a',
                method: 'GET',
                handler: function (request, reply) {

                    return reply('hello');
                },
                config: {
                    plugins: {
                        bananas: {
                            exclude: true
                        }
                    }
                }
            });

            server.start((err) => {

                expect(err).to.not.exist();

                server.inject('/a', (res1) => {

                    setTimeout(() => {

                        expect(updates.length).to.equal(1);
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

    it('logs uncaughtException event', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            uncaughtException: true
        };

        let updates = [];
        const orig = Wreck.post;
        Wreck.post = function (uri, options, next) {

            updates = updates.concat(options.payload.split('\n'));
            return next();
        };

        const exit = process.exit;
        process.exit = (code) => {

            process.exit = exit;
            Wreck.post = orig;

            expect(updates.length).to.equal(2);
            expect(code).to.equal(1);
            done();
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();
            process.emit('uncaughtException', new Error('boom'));
        });
    });
});
