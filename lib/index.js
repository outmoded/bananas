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
        root: false,
        exclude: [],
        uncaughtException: false,
        signals: false,
        stopTimeoutMsec: 15 * 1000,             // 15 seconds
        tags: null
    }
};


exports.register = function (server, options, next) {

    Hoek.assert(options.token, 'Missing Loggly API token');

    const settings = Hoek.applyToDefaults(internals.defaults, options);
    server = (settings.root ? server.root : server);

    // Setup log queue

    const uri = `https://logs-01.loggly.com/bulk/${settings.token}`;
    let updates = [];
    const flush = function (callback) {

        callback = callback || Hoek.ignore;

        if (!updates.length) {
            return callback();
        }

        const holder = updates;
        updates = [];

        holder.forEach((update) => {

            if (settings.tags) {
                update.tags = (update.tags ? settings.tags.concat(update.tags) : settings.tags);
            }
        });

        const payload = holder.map(FastSafeStringify).join('\n');
        Wreck.post(uri, { payload, headers: { 'content-type': 'application/json' }, json: true }, callback);
    };

    // Setup flush intervals

    const timerId = setInterval(flush, settings.intervalMsec);

    // Listen to system exceptions and signals

    if (settings.uncaughtException) {
        process.once('uncaughtException', (err) => {

            const uncaught = internals.update('error');
            uncaught.error = {
                message: err.message,
                stack: err.stack,
                data: err.data
            };

            uncaught.tags = ['bananas', 'uncaught', 'error'];
            updates.push(uncaught);

            return flush((ignore) => {

                process.exit(1);
            });
        });
    }

    if (settings.signals) {
        const shutdown = (signal) => {

            return () => {

                const end = internals.update('server');
                end.tags = ['bananas', 'signal', signal];
                updates.push(end);
                server.root.stop({ timeout: settings.stopTimeoutMsec }, process.exit);
            };
        };

        process.once('SIGTERM', shutdown('SIGTERM'));
        process.once('SIGINT', shutdown('SIGINT'));
    }

    // Listen to server events

    const onPostStop = function (srv, nextExt) {

        clearInterval(timerId);

        if (settings.signals) {
            process.removeAllListeners('SIGTERM');
            process.removeAllListeners('SIGINT');
        }

        const end = internals.update('server');
        end.tags = ['bananas', 'stopped'];
        updates.push(end);
        return flush(nextExt);
    };

    server.ext('onPostStop', onPostStop);

    // Subscribe to server events

    server.on('log', (event, tags) => {

        const update = internals.update('server');
        update.tags = event.tags;
        update.data = internals.error(event.data);

        updates.push(update);
    });

    server.on('response', (request) => {

        const routeSettings = request.route.settings.plugins.bananas || {};

        if (settings.exclude.indexOf(request.path) !== -1 || routeSettings.exclude) {
            return;
        }

        const update = internals.update('response', request);
        update.code = request.raw.res.statusCode;

        if (update.code >= 400) {
            update.error = request.response.source;
        }

        updates.push(update);
    });

    server.on('request-error', (request, err) => {

        const update = internals.update('error', request);
        update.error = internals.error(err);
        updates.push(update);
    });

    // Log initialization

    const init = internals.update('server');
    init.tags = ['bananas', 'initialized'];
    init.env = process.env;
    updates.push(init);
    return flush(next);
};


exports.register.attributes = {
    pkg: require('../package.json')
};


internals.update = function (event, request) {

    const now = Date.now();

    const update = {
        event: event,
        timestamp: now,
        host: Os.hostname()
    };

    if (request) {
        update.path = request.path;
        update.query = request.query;
        update.method = request.method;
        update.request = {
            id: request.id,
            received: request.info.received,
            elapsed: now - request.info.received,
            remoteIP: request.headers['x-forwarded-for']
        };
    }

    return update;
};


internals.error = function (data) {

    if (data instanceof Error === false) {
        return data;
    }

    const error = {
        message: data.message,
        stack: data.stack
    };

    if (data.data) {
        error.data = data.data;
    }

    return error;
};
