var util = require('util');
var fs = require('fs');
var path = require('path');
var _ = require('underscore');
var convict = require('convict');

var conf = convict({
    env: {
        doc: "The application environment.",
        format: ["production", "development", "test"],
        default: "development",
        env: "NODE_ENV",
        arg: "node-env"
    },
    secret: {
        doc: "Secret key for web app sessions",
        format: String,
        default: '8675309'
    },
    silent: {
        doc: "Silence informational and debug output",
        format: Boolean,
        default: false
    },
    ip: {
        doc: "The IP address to bind.",
        format: "ipaddress",
        default: "127.0.0.1",
        env: "IP_ADDRESS",
    },
    port: {
        doc: "The port to bind.",
        format: "port",
        default: 5000,
        env: "PORT"
    },
    database: {
        doc: "Main database connection details",
        format: "*",
        default: {
            "client": "sqlite",
            // "debug": true,
            "connection": {
                "filename": "./data/main.sqlite"
            }
        }
    },
    database_eve_static: {
        doc: 'EVE static data export database',
        format: '*',
        default: {
            client: 'sqlite3',
            connection: {
                filename: './data/eve.sqlite'
            }
        }
    },
    eve_sqlite: {
        doc: 'Path to an uncompressed SQLite export of EVE static data - i.e. ' +
            'https://www.fuzzwork.co.uk/dump/sqlite-latest.sqlite.bz2',
        default: './data/eve.sqlite',
        format: '*'
    },
    marketlogs_path: {
        doc: 'Path to exported market logs',
        default: './marketlogs',
        format: '*'
    },
    neow_cache_path: {
        doc: 'Path to NEOW disk cache files',
        default: './cache/neow',
        format: '*'
    },
    neow_api_base: {
        doc: 'Base URL for EVE API',
        default: 'https://api.eveonline.com',
        format: '*'
    },
    market_history_import_limit: {
        doc: 'Maximum newest market history entries to accept in import queue',
        default: 90,
        format: '*'
    }
});

var env = conf.get('env');
var files = [
    // Built-in configs
    path.join(__dirname, 'config', 'global.json'),
    path.join(__dirname, 'config', env + '.json'),
    // Local configs
    path.join(process.cwd(), 'config', 'global.json'),
    path.join(process.cwd(), 'config', env + '.json'),
];
for (var i=0, file; file=files[i]; i++) {
    if (fs.existsSync(file)) {
        conf.loadFile(file);
    }
}
conf.validate();

// Initialize some common resources based on config
var knex = require('knex');
conf.db_EVE = knex(conf.get('database_eve_static'));
conf.db_Main = knex(conf.get('database'));
conf.Bookshelf_Main = require('bookshelf')(conf.db_Main);

module.exports = conf;
