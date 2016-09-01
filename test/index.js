'use strict';

// Load modules

const Os = require('os');
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

    it('logs error events', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            tags: ['test']
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

                    const error = new Error('oops');
                    error.data = 42;
                    server.log(['some', 'tags'], error);

                    setTimeout(() => {

                        updates = updates.map(JSON.parse);
                        expect(updates).to.equal([
                            {
                                event: 'server',
                                timestamp: updates[0].timestamp,
                                host: Os.hostname(),
                                tags: ['test', 'bananas', 'initialized'],
                                env: JSON.parse(JSON.stringify(process.env))
                            },
                            {
                                event: 'server',
                                timestamp: updates[1].timestamp,
                                host: Os.hostname(),
                                tags: ['test', 'server event']
                            },
                            {
                                event: 'server',
                                timestamp: updates[2].timestamp,
                                host: Os.hostname(),
                                tags: ['test', 'some', 'tags'],
                                data: {
                                    message: 'oops',
                                    stack: updates[2].data.stack,
                                    data: 42
                                }
                            },
                            {
                                event: 'error',
                                timestamp: updates[3].timestamp,
                                host: Os.hostname(),
                                tags: ['test'],
                                path: '/',
                                query: {},
                                method: 'get',
                                request: {
                                    id: updates[3].request.id,
                                    received: updates[3].request.received,
                                    elapsed: updates[3].request.elapsed
                                },
                                error: {
                                    message: 'Uncaught error: boom',
                                    stack: updates[3].error.stack
                                }
                            },
                            {
                                event: 'response',
                                timestamp: updates[4].timestamp,
                                host: Os.hostname(),
                                tags: ['test'],
                                path: '/',
                                query: {},
                                method: 'get',
                                request: {
                                    id: updates[4].request.id,
                                    received: updates[4].request.received,
                                    elapsed: updates[4].request.elapsed
                                },
                                code: 500,
                                error: {
                                    statusCode: 500,
                                    error: 'Internal Server Error',
                                    message: 'An internal server error occurred'
                                }
                            }
                        ]);

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

    it('logs signal (SIGTERM)', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const settings = {
            token: 'abcdefg',
            signals: true,
            tags: ['test']
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

            updates = updates.map(JSON.parse);
            expect(updates).to.equal([
                {
                    event: 'server',
                    timestamp: updates[0].timestamp,
                    host: Os.hostname(),
                    tags: ['test', 'bananas', 'initialized'],
                    env: JSON.parse(JSON.stringify(process.env))
                },
                {
                    event: 'server',
                    timestamp: updates[1].timestamp,
                    host: Os.hostname(),
                    tags: ['test', 'bananas', 'signal', 'SIGTERM']
                },
                {
                    event: 'server',
                    timestamp: updates[2].timestamp,
                    host: Os.hostname(),
                    tags: ['test', 'bananas', 'stopped']
                }
            ]);
            done();
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();
            process.emit('SIGTERM');
        });
    });

    it('logs signal (SIGINT)', { parallel: false }, (done) => {

        const server = new Hapi.Server({ debug: false });
        server.connection();

        const settings = {
            token: 'abcdefg',
            signals: true
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

            updates = updates.map(JSON.parse);
            expect(updates).to.equal([
                {
                    event: 'server',
                    timestamp: updates[0].timestamp,
                    host: Os.hostname(),
                    tags: ['bananas', 'initialized'],
                    env: JSON.parse(JSON.stringify(process.env))
                },
                {
                    event: 'server',
                    timestamp: updates[1].timestamp,
                    host: Os.hostname(),
                    tags: ['bananas', 'signal', 'SIGINT']
                },
                {
                    event: 'server',
                    timestamp: updates[2].timestamp,
                    host: Os.hostname(),
                    tags: ['bananas', 'stopped']
                }
            ]);
            done();
        };

        server.register({ register: Bananas, options: settings }, (err) => {

            expect(err).to.not.exist();
            process.emit('SIGINT');
        });
    });
});
