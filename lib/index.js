'use strict';

// Load modules

const Os = require('os');
const Hoek = require('hoek');
const Wreck = require('wreck');


// Declare internals

const internals = {
    defaults: {
        intervalMsec: 1000
    }
};


exports.register = function (server, options, next) {

    Hoek.assert(options.token, 'Missing Loggly API token');

    const settings = Hoek.applyToDefaults(internals.defaults, options);

    // Setup log queue and flush intervals

    const uri = `https://logs-01.loggly.com/bulk/${settings.token}`;
    let updates = [];
    const flush = function () {

        if (!updates.length) {
            return;
        }

        const holder = updates;
        updates = [];

        const payload = holder.map(JSON.stringify).join('\n');
        Wreck.post(uri, { payload, headers: { 'content-type': 'application/json' }, json: true }, Hoek.ignore);     // No point in loggin errors
    };

    const timerId = setInterval(flush, settings.intervalMsec);

    const onPostStop = function (srv, nextExt) {

        clearInterval(timerId);
        return nextExt();
    };

    server.ext('onPostStop', onPostStop);

    // Subscribe to server events

    server.on('log', (event, tags) => {

        const update = internals.update('server');
        update.tags = event.tags;
        update.data = event.data;

        updates.push(update);
    });

    server.on('response', (request) => {

        const update = internals.update('response', request);
        update.code = request.raw.res.statusCode;

        updates.push(update);
    });

    server.on('request-error', (request, err) => {

        const update = internals.update('error', request);
        update.error = {
            message: err.message,
            stack: err.stack,
            data: err.data
        };

        updates.push(update);
    });

    return next();
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
            elapsed: now - request.info.received
        };
    }

    return update;
};
