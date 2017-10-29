'use strict';

// Load modules

const Os = require('os');

const Bananas = require('../');
const Code = require('code');
const Hapi = require('hapi');
const Hoek = require('hoek');
const Lab = require('lab');
const Teamwork = require('teamwork');
const Wreck = require('wreck');


// Declare internals

const internals = {};


// Test shortcuts

const { describe, it } = exports.lab = Lab.script();
const expect = Code.expect;


describe('Bananas', () => {

    const originalPost = Wreck.post;
    const restorePost = () => {

        Wreck.post = originalPost;
    };

    it('logs error events', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            tags: ['test', 'test2']
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({
                'content-type': 'application/json',
                'x-loggly-tag': 'test,test2'
            });

            updates = updates.concat(options.payload.split('\n'));
        };

        const timeBeforeBananasRegister = new Date();
        await server.register({ plugin: Bananas, options: settings });

        server.route({
            path: '/{param1}/b/{param2}',
            method: 'GET',
            handler: function (request) {

                request.server.log('server event');
                throw new Error('boom 1');
            }
        });

        const timeBeforeServerStart = new Date();
        await server.start();
        const timeBeforeInject = new Date();

        await server.inject('/123/b/456');

        const error = new Error('oops 2');
        error.data = 42;
        server.log(['some', 'tags'], error);
        server.log(['data'], { some: 'data' });

        await Hoek.wait(200);

        updates = updates.map(JSON.parse);
        expect(updates).to.equal([
            {
                event: 'server',
                timestamp: updates[0].timestamp,
                host: Os.hostname(),
                tags: ['test', 'test2', 'bananas', 'initialized'],
                env: JSON.parse(JSON.stringify(process.env))
            },
            {
                event: 'server',
                timestamp: updates[1].timestamp,
                host: Os.hostname(),
                tags: ['test', 'test2', 'server event']
            },
            {
                event: 'error',
                timestamp: updates[2].timestamp,
                host: Os.hostname(),
                tags: ['test', 'test2'],
                path: '/123/b/456',
                routePath: '/{param1}/b/{param2}',
                params: {
                    param1: '123',
                    param2: '456'
                },
                query: {},
                method: 'get',
                request: {
                    id: updates[2].request.id,
                    received: updates[2].request.received,
                    elapsed: updates[2].request.elapsed
                },
                error: {
                    message: 'boom 1',
                    stack: updates[2].error.stack
                }
            },
            {
                event: 'response',
                timestamp: updates[3].timestamp,
                host: Os.hostname(),
                tags: ['test', 'test2'],
                path: '/123/b/456',
                routePath: '/{param1}/b/{param2}',
                params: {
                    param1: '123',
                    param2: '456'
                },
                query: {},
                method: 'get',
                request: {
                    id: updates[3].request.id,
                    received: updates[3].request.received,
                    elapsed: updates[3].request.elapsed
                },
                code: 500,
                error: {
                    statusCode: 500,
                    error: 'Internal Server Error',
                    message: 'An internal server error occurred'
                }
            },
            {
                event: 'server',
                timestamp: updates[4].timestamp,
                host: Os.hostname(),
                tags: ['test', 'test2', 'some', 'tags'],
                error: {
                    message: 'oops 2',
                    stack: updates[4].error.stack,
                    data: 42
                }
            },
            {
                event: 'server',
                timestamp: updates[5].timestamp,
                host: Os.hostname(),
                tags: ['test', 'test2', 'data'],
                data: { some: 'data' }
            }

        ]);

        expect(new Date(updates[0].timestamp)).to.be.between(timeBeforeBananasRegister, new Date());
        expect(new Date(updates[1].timestamp)).to.be.between(timeBeforeServerStart, new Date());

        updates.slice(2).forEach((update) => {

            expect(new Date(update.timestamp)).to.be.between(timeBeforeInject, new Date());
        });

        const timeBeforeStop = Date.now();

        await server.stop();

        expect(updates.length).to.equal(7);
        const lastUpdate = JSON.parse(updates[6]);
        expect(lastUpdate).to.equal({
            event: 'server',
            timestamp: lastUpdate.timestamp,
            host: Os.hostname(),
            tags: ['test', 'test2', 'bananas', 'stopped']
        });

        expect(lastUpdate.timestamp).to.be.between(timeBeforeStop - 1, Date.now() + 1);
    });

    it('logs valid event', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'gfedcba',
            intervalMsec: 50
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/gfedcba');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({ 'content-type': 'application/json' });
            updates = updates.concat(options.payload.split('\n'));
        };

        await server.register({ plugin: Bananas, options: settings });

        server.route({
            path: '/',
            method: 'GET',
            handler: () => 'hello'
        });

        await server.start();

        await server.inject('/');
        await Hoek.wait(200);

        expect(updates.length).to.equal(2);

        await server.stop();
    });

    it('logs valid event on late connection', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });
        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            root: true
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({ 'content-type': 'application/json' });
            updates = updates.concat(options.payload.split('\n'));
        };

        await server.register({ plugin: Bananas, options: settings });

        server.route({
            path: '/',
            method: 'GET',
            handler: () => 'hello'
        });

        await server.start();

        await server.inject('/');
        await Hoek.wait(200);
        expect(updates.length).to.equal(2);

        await server.stop();
    });

    it('logs valid event', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            exclude: ['/b']
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({ 'content-type': 'application/json' });
            updates = updates.concat(options.payload.split('\n'));
        };

        await server.register({ plugin: Bananas, options: settings });

        server.route({
            path: '/a',
            method: 'GET',
            handler: () => 'hello'
        });

        server.route({
            path: '/b',
            method: 'GET',
            handler: () => 'hello'
        });

        await server.start();

        await server.inject('/a');
        await server.inject('/b');

        await Hoek.wait(200);

        expect(updates.length).to.equal(2);
        await server.stop();
    });

    it('filter routes with flags', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            exclude: ['/b']
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({ 'content-type': 'application/json' });
            updates = updates.concat(options.payload.split('\n'));
        };

        await server.register({ plugin: Bananas, options: settings });

        server.route({
            path: '/a',
            method: 'GET',
            handler: () => 'hello',
            config: {
                plugins: {
                    bananas: {
                        exclude: true
                    }
                }
            }
        });

        await server.start();

        await server.inject('/a');
        await Hoek.wait(200);
        expect(updates.length).to.equal(1);

        await server.stop();
    });

    it('logs signal (SIGTERM)', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'abcdefg',
            signals: true,
            tags: ['test']
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({
                'content-type': 'application/json',
                'x-loggly-tag': 'test'
            });
            updates = updates.concat(options.payload.split('\n'));
        };

        const team = new Teamwork();
        const exit = process.exit;
        process.exit = (code) => {

            process.exit = exit;

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
            expect(process.listenerCount('SIGTERM')).to.equal(0);
            expect(process.listenerCount('SIGINT')).to.equal(0);
            team.attend();
        };

        await server.register({ plugin: Bananas, options: settings });
        process.emit('SIGTERM');
        await team.work;
    });

    it('logs signal (SIGINT)', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'abcdefg',
            signals: true
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({ 'content-type': 'application/json' });
            updates = updates.concat(options.payload.split('\n'));
        };

        const team = new Teamwork();
        const exit = process.exit;
        process.exit = (code) => {

            process.exit = exit;

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
            expect(process.listenerCount('SIGTERM')).to.equal(0);
            expect(process.listenerCount('SIGINT')).to.equal(0);
            team.attend();
        };

        await server.register({ plugin: Bananas, options: settings });
        process.emit('SIGINT');
        await team.work;
    });

    it('records request authentication', async (flags) => {

        flags.onCleanup = restorePost;

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            exclude: ['/b'],
            credentials: function (request) {

                return { user: request.auth.credentials.user };
            }
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            updates = updates.concat(options.payload.split('\n'));
        };

        await server.register({ plugin: Bananas, options: settings });

        server.route({
            path: '/a',
            method: 'GET',
            handler: function (request) {

                request.auth.credentials = { user: 'steve' };
                return 'hello';
            }
        });

        await server.start();

        await server.inject('/a');
        await Hoek.wait(200);

        expect(updates.length).to.equal(2);
        expect(JSON.parse(updates[1]).auth).to.equal({ user: 'steve' });

        await server.stop();
    });

    it('logs uncaughtException event', async (flags) => {

        flags.onCleanup = restorePost;

        process.removeAllListeners('uncaughtException');

        const server = Hapi.server({ debug: false });
        await server.start();

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            uncaughtException: true
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({ 'content-type': 'application/json' });
            updates = updates.concat(options.payload.split('\n'));
        };

        const team = new Teamwork();
        const exit = process.exit;
        process.exit = (code) => {

            process.exit = exit;

            expect(updates.length).to.equal(2);
            expect(code).to.equal(1);
            team.attend();
        };

        await server.register({ plugin: Bananas, options: settings });
        process.emit('uncaughtException', new Error('boom'));
        await team.work;
        await server.stop();
    });

    it('logs unhandledRejection event', async (flags) => {

        flags.onCleanup = restorePost;

        process.removeAllListeners('unhandledRejection');

        const server = Hapi.server({ debug: false });

        const settings = {
            token: 'abcdefg',
            intervalMsec: 50,
            uncaughtException: true
        };

        let updates = [];
        Wreck.post = function (uri, options) {

            expect(uri).to.equal('https://logs-01.loggly.com/bulk/abcdefg');
            expect(options.json).to.be.true();
            expect(options.headers).to.equal({ 'content-type': 'application/json' });
            updates = updates.concat(options.payload.split('\n'));
        };

        const team = new Teamwork();
        const exit = process.exit;
        process.exit = (code) => {

            process.exit = exit;

            expect(updates.length).to.equal(2);
            expect(code).to.equal(1);
            team.attend();
        };

        await server.register({ plugin: Bananas, options: settings });

        Promise.reject(new Error('Boom'));

        await Hoek.wait(100);

        expect(updates[1]).to.contain('"tags":["bananas","uncaught","error"]');
        await team.work;
    });
});
