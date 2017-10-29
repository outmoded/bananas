'use strict';

// Load modules

const Os = require('os');

const Hoek = require('hoek');
const Wreck = require('wreck');
const FastSafeStringify = require('fast-safe-stringify');


// Declare internals

const internals = {
    defaults: {
        intervalMsec: 1000,                     // 1 second
        exclude: [],
        uncaughtException: false,
        signals: false,
        stopTimeoutMsec: 15 * 1000,             // 15 seconds
        tags: null
    }
};


exports.plugin = {
    pkg: require('../package.json'),
    register: async function (server, options) {

        Hoek.assert(options.token, 'Missing Loggly API token');

        const settings = Hoek.applyToDefaults(internals.defaults, options);

        // Setup log queue

        const uri = `https://logs-01.loggly.com/bulk/${settings.token}`;
        let updates = [];
        const flush = function () {

            if (!updates.length) {
                return;
            }

            const holder = updates;
            updates = [];

            holder.forEach((update) => {

                if (settings.tags) {
                    update.tags = (update.tags ? settings.tags.concat(update.tags) : settings.tags);
                }
            });

            const payload = holder.map(FastSafeStringify).join('\n');
            const headers = { 'content-type': 'application/json' };
            if (settings.tags) {
                headers['x-loggly-tag'] = settings.tags.join(',');
            }

            return Wreck.post(uri, { payload, headers, json: true });
        };

        // Setup flush intervals

        const timerId = setInterval(flush, settings.intervalMsec);

        // Listen to system exceptions and signals

        let onException;
        if (settings.uncaughtException) {
            onException = async (err) => {

                const uncaught = internals.update('error', null, settings);
                uncaught.error = {
                    message: err.message,
                    stack: err.stack,
                    data: err.data
                };

                uncaught.tags = ['bananas', 'uncaught', 'error'];
                updates.push(uncaught);

                await flush();
                process.exit(1);
            };

            process.on('uncaughtException', onException);
            process.on('unhandledRejection', onException);
        }

        if (settings.signals) {
            const shutdown = (signal) => {

                return async () => {

                    const end = internals.update('server', null, settings);
                    end.tags = ['bananas', 'signal', signal];
                    updates.push(end);
                    await server.stop({ timeout: settings.stopTimeoutMsec });
                    process.exit();
                };
            };

            process.once('SIGTERM', shutdown('SIGTERM'));
            process.once('SIGINT', shutdown('SIGINT'));
        }

        // Listen to server events

        const onPostStop = async function (srv) {

            clearInterval(timerId);

            if (settings.uncaughtException) {
                process.removeListener('uncaughtException', onException);
                process.removeListener('unhandledRejection', onException);
            }

            if (settings.signals) {
                process.removeAllListeners('SIGTERM');
                process.removeAllListeners('SIGINT');
            }

            const end = internals.update('server', null, settings);
            end.tags = ['bananas', 'stopped'];
            updates.push(end);
            await flush();
        };

        server.ext('onPostStop', onPostStop);

        // Subscribe to server events

        server.events.on('log', (event, tags) => {

            const update = internals.update('server', null, settings);
            update.tags = event.tags;
            if (event.error) {
                update.error = internals.error(event.error);
            }
            else if (event.data) {
                update.data = event.data;
            }

            updates.push(update);
        });

        server.events.on({ name: 'request', channels: 'error' }, (request, event) => {

            const update = internals.update('error', request, settings);
            update.error = internals.error(event.error);
            updates.push(update);
        });

        server.events.on('response', (request) => {

            const routeSettings = request.route.settings.plugins.bananas || {};

            if (settings.exclude.indexOf(request.path) !== -1 ||
                routeSettings.exclude) {

                return;
            }

            const update = internals.update('response', request, settings);
            update.code = request.raw.res.statusCode;

            if (update.code >= 400) {
                update.error = request.response.source;
            }

            updates.push(update);
        });

        // Log initialization

        const init = internals.update('server', null, settings);
        init.tags = ['bananas', 'initialized'];
        init.env = process.env;
        updates.push(init);
        await flush();
    }
};


internals.update = function (event, request, options) {

    const now = Date.now();

    const update = {
        event,
        timestamp: now,
        host: Os.hostname()
    };

    if (request) {
        update.path = request.path;
        update.query = request.query;
        update.params = request.params;
        update.routePath = request.route.path;
        update.method = request.method;
        update.request = {
            id: request.info.id,
            received: request.info.received,
            elapsed: now - request.info.received,
            remoteIP: request.headers['x-forwarded-for']
        };

        if (request.auth.credentials &&
            options.credentials) {

            update.auth = options.credentials(request);
        }
    }

    return update;
};


internals.error = function (data) {

    const error = {
        message: data.message,
        stack: data.stack
    };

    if (data.data) {
        error.data = data.data;
    }

    return error;
};
