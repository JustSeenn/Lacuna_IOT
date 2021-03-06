"use strict";
/* eslint-disable @typescript-eslint/unified-signatures */
/* eslint-disable no-dupe-class-members */
/* eslint-disable no-prototype-builtins */
function __export(m) {
    for (var p in m) if (!exports.hasOwnProperty(p)) exports[p] = m[p];
}
Object.defineProperty(exports, "__esModule", { value: true });
const url = require("url");
const b = require("./builder");
const grammar = require("./grammar");
const pool_1 = require("./pool");
const results_1 = require("./results");
const schema_1 = require("./schema");
const defaultHost = Object.freeze({
    host: '127.0.0.1',
    port: 8086,
    protocol: 'http'
});
const defaultOptions = Object.freeze({
    database: null,
    hosts: [],
    password: 'root',
    schema: [],
    username: 'root'
});
__export(require("./builder"));
var grammar_1 = require("./grammar");
exports.FieldType = grammar_1.FieldType;
exports.Precision = grammar_1.Precision;
exports.Raw = grammar_1.Raw;
exports.escape = grammar_1.escape;
exports.toNanoDate = grammar_1.toNanoDate;
var results_2 = require("./results");
exports.ResultError = results_2.ResultError;
/**
 * Parses the URL out into into a IClusterConfig object
 */
function parseOptionsUrl(addr) {
    const parsed = url.parse(addr);
    const options = {
        host: parsed.hostname,
        port: Number(parsed.port),
        protocol: parsed.protocol.slice(0, -1)
    };
    if (parsed.auth) {
        [options.username, options.password] = parsed.auth.split(':');
    }
    if (parsed.pathname.length > 1) {
        options.database = parsed.pathname.slice(1);
    }
    return options;
}
/**
 * Works similarly to Object.assign, but only overwrites
 * properties that resolve to undefined.
 */
function defaults(target, ...srcs) {
    srcs.forEach(src => {
        Object.keys(src).forEach((key) => {
            if (target[key] === undefined) {
                target[key] = src[key];
            }
        });
    });
    return target;
}
/**
 * InfluxDB is the public interface to run queries against the your database.
 * This is a 'driver-level' module, not a a full-fleged ORM or ODM; you run
 * queries directly by calling methods on this class.
 *
 * Please check out some of [the tutorials](https://node-influx.github.io/manual/tutorial.html)
 * if you want help getting started!
 *
 * @example
 * const Influx = require('influx');
 * const influx = new Influx.InfluxDB({
 *  host: 'localhost',
 *  database: 'express_response_db',
 *  schema: [
 *    {
 *      measurement: 'response_times',
 *      fields: {
 *        path: Influx.FieldType.STRING,
 *        duration: Influx.FieldType.INTEGER
 *      },
 *      tags: [
 *        'host'
 *      ]
 *    }
 *  ]
 * })
 *
 * @example
 * // Connect over HTTPS
 * const Influx = require('influx');
 * const influx = new Influx.InfluxDB({
 *  host: 'myinfluxdbhost',
 *  port: 443,
 *  protocol: 'https'
 *  database: 'express_response_db',
 *  schema: [
 *    {
 *      measurement: 'response_times',
 *      fields: {
 *        path: Influx.FieldType.STRING,
 *        duration: Influx.FieldType.INTEGER
 *      },
 *      tags: [
 *        'host'
 *      ]
 *    }
 *  ]
 * })
 *
 * influx.writePoints([
 *   {
 *     measurement: 'response_times',
 *     tags: { host: os.hostname() },
 *     fields: { duration, path: req.path },
 *   }
 * ]).then(() => {
 *   return influx.query(`
 *     select * from response_times
 *     where host = ${Influx.escape.stringLit(os.hostname())}
 *     order by time desc
 *     limit 10
 *   `)
 * }).then(rows => {
 *   rows.forEach(row => console.log(`A request to ${row.path} took ${row.duration}ms`))
 * })
 */
class InfluxDB {
    /**
   * Connect to a single InfluxDB instance by specifying
   * a set of connection options.
   * @param [options='http://root:root@127.0.0.1:8086']
   *
   * @example
   * const Influx = require('influx')
   *
   * // Connect to a single host with a DSN:
   * const influx = new Influx.InfluxDB('http://user:password@host:8086/database')
   *
   * @example
   * const Influx = require('influx')
   *
   * // Connect to a single host with a full set of config details and
   * // a custom schema
   * const client = new Influx.InfluxDB({
   *   database: 'my_db',
   *   host: 'localhost',
   *   port: 8086,
   *   username: 'connor',
   *   password: 'pa$$w0rd',
   *   schema: [
   *     {
   *       measurement: 'perf',
   *       fields: {
   *         memory_usage: Influx.FieldType.INTEGER,
   *         cpu_usage: Influx.FieldType.FLOAT,
   *         is_online: Influx.FieldType.BOOLEAN
   *       }
   *       tags: [
   *         'hostname'
   *       ]
   *     }
   *   ]
   * })
   *
   * @example
   * const Influx = require('influx')
   *
   * // Use a pool of several host connections and balance queries across them:
   * const client = new Influx.InfluxDB({
   *   database: 'my_db',
   *   username: 'connor',
   *   password: 'pa$$w0rd',
   *   hosts: [
   *     { host: 'db1.example.com' },
   *     { host: 'db2.example.com' },
   *   ],
   *   schema: [
   *     {
   *       measurement: 'perf',
   *       fields: {
   *         memory_usage: Influx.FieldType.INTEGER,
   *         cpu_usage: Influx.FieldType.FLOAT,
   *         is_online: Influx.FieldType.BOOLEAN
   *       }
   *       tags: [
   *         'hostname'
   *       ]
   *     }
   *   ]
   * })
   *
   */
    constructor(options) {
        /**
       * Map of Schema instances defining measurements in Influx.
       * @private
       */
        this._schema = Object.create(null);
        // Figure out how to parse whatever we were passed in into a IClusterConfig.
        if (typeof options === 'string') {
            // Plain URI => ISingleHostConfig
            options = parseOptionsUrl(options);
        }
        else if (!options) {
            options = defaultHost;
        }
        if (!options.hasOwnProperty('hosts')) {
            // ISingleHostConfig => IClusterConfig
            options = {
                database: options.database,
                hosts: [options],
                password: options.password,
                pool: options.pool,
                schema: options.schema,
                username: options.username
            };
        }
        const resolved = options;
        resolved.hosts = resolved.hosts.map(host => {
            return defaults({
                host: host.host,
                port: host.port,
                protocol: host.protocol,
                options: host.options
            }, defaultHost);
        });
        this._pool = new pool_1.Pool(resolved.pool);
        this._options = defaults(resolved, defaultOptions);
        resolved.hosts.forEach(host => {
            this._pool.addHost(`${host.protocol}://${host.host}:${host.port}`, host.options);
        });
        this._options.schema.forEach(schema => {
            schema.database = schema.database || this._options.database;
            const db = schema.database;
            if (!db) {
                throw new Error(`Schema ${schema.measurement} doesn't have a database specified,` +
                    'and no default database is provided!');
            }
            if (!this._schema[db]) {
                this._schema[db] = Object.create(null);
            }
            this._schema[db][schema.measurement] = new schema_1.Schema(schema);
        });
    }
    /**
   * Creates a new database with the provided name.
   * @param databaseName
   * @return
   * @example
   * influx.createDatabase('mydb')
   */
    createDatabase(databaseName) {
        return this._pool
            .json(this._getQueryOpts({
            q: `create database ${grammar.escape.quoted(databaseName)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Deletes a database with the provided name.
   * @param databaseName
   * @return
   * @example
   * influx.dropDatabase('mydb')
   */
    dropDatabase(databaseName) {
        return this._pool
            .json(this._getQueryOpts({
            q: `drop database ${grammar.escape.quoted(databaseName)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Returns array of database names. Requires cluster admin privileges.
   * @returns a list of database names
   * @example
   * influx.getDatabaseNames().then(names =>
   *   console.log('My database names are: ' + names.join(', ')));
   */
    getDatabaseNames() {
        return this._pool
            .json(this._getQueryOpts({ q: 'show databases' }))
            .then(res => results_1.parseSingle(res).map(r => r.name));
    }
    /**
   * Returns array of measurements.
   * @returns a list of measurement names
   * @param [database] the database the measurement lives in, optional
   *     if a default database is provided.
   * @example
   * influx.getMeasurements().then(names =>
   *   console.log('My measurement names are: ' + names.join(', ')));
   */
    getMeasurements(database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            db: database,
            q: 'show measurements'
        }))
            .then(res => results_1.parseSingle(res).map(r => r.name));
    }
    /**
   * Returns a list of all series within the target measurement, or from the
   * entire database if a measurement isn't provided.
   * @param [options]
   * @param [options.measurement] if provided, we'll only get series
   *     from within that measurement.
   * @param [options.database] the database the series lives in,
   *     optional if a default database is provided.
   * @returns a list of series names
   * @example
   * influx.getSeries().then(names => {
   *   console.log('My series names in my_measurement are: ' + names.join(', '))
   * })
   *
   * influx.getSeries({
   *   measurement: 'my_measurement',
   *   database: 'my_db'
   * }).then(names => {
   *   console.log('My series names in my_measurement are: ' + names.join(', '))
   * })
   */
    getSeries(options = {}) {
        const { database = this._defaultDB(), measurement } = options;
        let query = 'show series';
        if (measurement) {
            query += ` from ${grammar.escape.quoted(measurement)}`;
        }
        return this._pool
            .json(this._getQueryOpts({
            db: database,
            q: query
        }))
            .then(res => results_1.parseSingle(res).map(r => r.key));
    }
    /**
   * Removes a measurement from the database.
   * @param measurement
   * @param [database] the database the measurement lives in, optional
   *     if a default database is provided.
   * @return
   * @example
   * influx.dropMeasurement('my_measurement')
   */
    dropMeasurement(measurement, database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            db: database,
            q: `drop measurement ${grammar.escape.quoted(measurement)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Removes a one or more series from InfluxDB.
   *
   * @returns
   * @example
   * // The following pairs of queries are equivalent: you can chose either to
   * // use our builder or pass in string directly. The builder takes care
   * // of escaping and most syntax handling for you.
   *
   * influx.dropSeries({ where: e => e.tag('cpu').equals.value('cpu8') })
   * influx.dropSeries({ where: '"cpu" = \'cpu8\'' })
   * // DROP SERIES WHERE "cpu" = 'cpu8'
   *
   * influx.dropSeries({ measurement: m => m.name('cpu').policy('autogen') })
   * influx.dropSeries({ measurement: '"cpu"."autogen"' })
   * // DROP SERIES FROM "autogen"."cpu"
   *
   * influx.dropSeries({
   *   measurement: m => m.name('cpu').policy('autogen'),
   *   where: e => e.tag('cpu').equals.value('cpu8'),
   *   database: 'my_db'
   * })
   * // DROP SERIES FROM "autogen"."cpu" WHERE "cpu" = 'cpu8'
   */
    dropSeries(options) {
        const db = 'database' in options ? options.database : this._defaultDB();
        let q = 'drop series';
        if ('measurement' in options) {
            q += ' from ' + b.parseMeasurement(options);
        }
        if ('where' in options) {
            q += ' where ' + b.parseWhere(options);
        }
        return this._pool
            .json(this._getQueryOpts({ db, q }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Returns a list of users on the Influx database.
   * @return
   * @example
   * influx.getUsers().then(users => {
   *   users.forEach(user => {
   *     if (user.admin) {
   *       console.log(user.user, 'is an admin!')
   *     } else {
   *       console.log(user.user, 'is not an admin!')
   *     }
   *   })
   * })
   */
    getUsers() {
        return this._pool
            .json(this._getQueryOpts({ q: 'show users' }))
            .then(result => results_1.parseSingle(result));
    }
    /**
   * Creates a new InfluxDB user.
   * @param username
   * @param password
   * @param [admin=false] If true, the user will be given all
   *     privileges on all databases.
   * @return
   * @example
   * influx.createUser('connor', 'pa55w0rd', true) // make 'connor' an admin
   *
   * // make non-admins:
   * influx.createUser('not_admin', 'pa55w0rd')
   */
    createUser(username, password, admin = false) {
        return this._pool
            .json(this._getQueryOpts({
            q: `create user ${grammar.escape.quoted(username)} with password ` +
                grammar.escape.stringLit(password) +
                (admin ? ' with all privileges' : '')
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Sets a password for an Influx user.
   * @param username
   * @param password
   * @return
   * @example
   * influx.setPassword('connor', 'pa55w0rd')
   */
    setPassword(username, password) {
        return this._pool
            .json(this._getQueryOpts({
            q: `set password for ${grammar.escape.quoted(username)} = ` +
                grammar.escape.stringLit(password)
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Grants a privilege to a specified user.
   * @param username
   * @param privilege Should be one of 'READ' or 'WRITE'
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.grantPrivilege('connor', 'READ', 'my_db') // grants read access on my_db to connor
   */
    grantPrivilege(username, privilege, database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            q: `grant ${privilege} on ${grammar.escape.quoted(database)} ` +
                `to ${grammar.escape.quoted(username)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Removes a privilege from a specified user.
   * @param username
   * @param privilege Should be one of 'READ' or 'WRITE'
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.revokePrivilege('connor', 'READ', 'my_db') // removes read access on my_db from connor
   */
    revokePrivilege(username, privilege, database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            q: `revoke ${privilege} on ${grammar.escape.quoted(database)} from ` +
                grammar.escape.quoted(username)
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Grants admin privileges to a specified user.
   * @param username
   * @return
   * @example
   * influx.grantAdminPrivilege('connor')
   */
    grantAdminPrivilege(username) {
        return this._pool
            .json(this._getQueryOpts({
            q: `grant all to ${grammar.escape.quoted(username)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Removes a admin privilege from a specified user.
   * @param username
   * @return
   * @example
   * influx.revokeAdminPrivilege('connor')
   */
    revokeAdminPrivilege(username) {
        return this._pool
            .json(this._getQueryOpts({
            q: `revoke all from ${grammar.escape.quoted(username)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Removes a user from the database.
   * @param username
   * @return
   * @example
   * influx.dropUser('connor')
   */
    dropUser(username) {
        return this._pool
            .json(this._getQueryOpts({
            q: `drop user ${grammar.escape.quoted(username)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Creates a continuous query in a database
   * @param name The query name, for later reference
   * @param query The body of the query to run
   * @param [database] If not provided, uses the default database.
   * @param [resample] If provided, adds resample policy
   * @return
   * @example
   * influx.createContinuousQuery('downsample_cpu_1h', `
   *   SELECT MEAN(cpu) INTO "7d"."perf"
   *   FROM "1d"."perf" GROUP BY time(1m)
   * `, undefined, 'RESAMPLE FOR 7m')
   */
    createContinuousQuery(name, query, database = this._defaultDB(), resample = '') {
        return this._pool
            .json(this._getQueryOpts({
            q: `create continuous query ${grammar.escape.quoted(name)}` +
                ` on ${grammar.escape.quoted(database)} ${resample} begin ${query} end`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Returns a list of continous queries in the database.
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.showContinousQueries()
   */
    showContinousQueries(database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            db: database,
            q: 'show continuous queries'
        }))
            .then(result => results_1.parseSingle(result));
    }
    /**
   * Creates a continuous query in a database
   * @param name The query name
   * @param [database] If not provided, uses the default database.
   * @return
   * @example
   * influx.dropContinuousQuery('downsample_cpu_1h')
   */
    dropContinuousQuery(name, database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            q: `drop continuous query ${grammar.escape.quoted(name)}` +
                ` on ${grammar.escape.quoted(database)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Creates a new retention policy on a database. You can read more about
   * [Downsampling and Retention](https://docs.influxdata.com/influxdb/v1.0/
   * guides/downsampling_and_retention/) on the InfluxDB website.
   *
   * @param name The retention policy name
   * @param options
   * @param [options.database] Database to create the policy on,
   *     uses the default database if not provided.
   * @param options.duration How long data in the retention policy
   *     should be stored for, should be in a format like `7d`. See details
   *     [here](https://docs.influxdata.com/influxdb/v1.0/query_language/spec/#durations)
   * @param options.replication How many servers data in the series
   *     should be replicated to.
   * @param [options.isDefault] Whether the retention policy should
   *     be the default policy on the database.
   * @return
   * @example
   * influx.createRetentionPolicy('7d', {
   *  duration: '7d',
   *  replication: 1
   * })
   */
    createRetentionPolicy(name, options) {
        const q = `create retention policy ${grammar.escape.quoted(name)} on ` +
            grammar.escape.quoted(options.database || this._defaultDB()) +
            ` duration ${options.duration} replication ${options.replication}` +
            (options.isDefault ? ' default' : '');
        return this._pool
            .json(this._getQueryOpts({ q }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Alters an existing retention policy on a database.
   *
   * @param name The retention policy name
   * @param options
   * @param [options.database] Database to create the policy on,
   *     uses the default database if not provided.
   * @param options.duration How long data in the retention policy
   *     should be stored for, should be in a format like `7d`. See details
   *     [here](https://docs.influxdata.com/influxdb/v1.0/query_language/spec/#durations)
   * @param options.replication How many servers data in the series
   *     should be replicated to.
   * @param [options.default] Whether the retention policy should
   *     be the default policy on the database.
   * @return
   * @example
   * influx.alterRetentionPolicy('7d', {
   *  duration: '7d',
   *  replication: 1,
   *  default: true
   * })
   */
    alterRetentionPolicy(name, options) {
        const q = `alter retention policy ${grammar.escape.quoted(name)} on ` +
            grammar.escape.quoted(options.database || this._defaultDB()) +
            ` duration ${options.duration} replication ${options.replication}` +
            (options.isDefault ? ' default' : '');
        return this._pool
            .json(this._getQueryOpts({ q }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Deletes a retention policy and associated data. Note that the data will
   * not be immediately destroyed, and will hang around until Influx's
   * bi-hourly cron.
   *
   * @param name The retention policy name
   * @param [database] Database name that the policy lives in,
   *     uses the default database if not provided.
   * @return
   * @example
   * influx.dropRetentionPolicy('7d')
   */
    dropRetentionPolicy(name, database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            q: `drop retention policy ${grammar.escape.quoted(name)} ` +
                `on ${grammar.escape.quoted(database)}`
        }, 'POST'))
            .then(results_1.assertNoErrors)
            .then(() => undefined);
    }
    /**
   * Shows retention policies on the database
   *
   * @param [database] The database to list policies on, uses the
   *     default database if not provided.
   * @return
   * @example
   * influx.showRetentionPolicies().then(policies => {
   *   expect(policies.slice()).to.deep.equal([
   *     {
   *       name: 'autogen',
   *       duration: '0s',
   *       shardGroupDuration: '168h0m0s',
   *       replicaN: 1,
   *       default: true,
   *     },
   *     {
   *       name: '7d',
   *       duration: '168h0m0s',
   *       shardGroupDuration: '24h0m0s',
   *       replicaN: 1,
   *       default: false,
   *     },
   *   ])
   * })
   */
    showRetentionPolicies(database = this._defaultDB()) {
        return this._pool
            .json(this._getQueryOpts({
            q: `show retention policies on ${grammar.escape.quoted(database)}`
        }, 'GET'))
            .then(result => results_1.parseSingle(result));
    }
    /**
   * WritePoints sends a list of points together in a batch to InfluxDB. In
   * each point you must specify the measurement name to write into as well
   * as a list of tag and field values. Optionally, you can specify the
   * time to tag that point at, defaulting to the current time.
   *
   * If you defined a schema for the measurement in the options you passed
   * to `new Influx(options)`, we'll use that to make sure that types get
   * cast correctly and that there are no extraneous fields or columns.
   *
   * For best performance, it's recommended that you batch your data into
   * sets of a couple thousand records before writing it. In the future we'll
   * have some utilities within node-influx to make this easier.
   *
   * ---
   *
   * A note when using manually-specified times and precisions: by default
   * we write using the `ms` precision since that's what JavaScript gives us.
   * You can adjust this. However, there is some special behaviour if you
   * manually specify a timestamp in your points:
   *  - if you specify the timestamp as a Date object, we'll convert it to
   *    milliseconds and manipulate it as needed to get the right precision
   *  - if provide a INanoDate as returned from {@link toNanoTime} or the
   *    results from an Influx query, we'll be able to pull the precise
   *    nanosecond timestamp and manipulate it to get the right precision
   *  - if you provide a string or number as the timestamp, we'll pass it
   *    straight into Influx.
   *
   * Please see the IPoint and IWriteOptions types for a
   * full list of possible options.
   *
   * @param points
   * @param [options]
   * @return
   * @example
   * // write a point into the default database with
   * // the default retention policy.
   * influx.writePoints([
   *   {
   *     measurement: 'perf',
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   *   }
   * ])
   *
   * // you can manually specify the database,
   * // retention policy, and time precision:
   * influx.writePoints([
   *   {
   *     measurement: 'perf',
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   *     timestamp: getLastRecordedTime(),
   *   }
   * ], {
   *   database: 'my_db',
   *   retentionPolicy: '1d',
   *   precision: 's'
   * })
   */
    writePoints(points, options = {}) {
        const { database = this._defaultDB(), precision = 'n', retentionPolicy } = options;
        let payload = '';
        points.forEach(point => {
            const { fields = {}, tags = {}, measurement, timestamp } = point;
            const schema = this._schema[database] && this._schema[database][measurement];
            const fieldsPairs = schema ? schema.coerceFields(fields) : schema_1.coerceBadly(fields);
            const tagsNames = schema ? schema.checkTags(tags) : Object.keys(tags);
            payload += (payload.length > 0 ? '\n' : '') + measurement;
            for (let tagsName of tagsNames) {
                payload += ',' + grammar.escape.tag(tagsName) + '=' + grammar.escape.tag(tags[tagsName]);
            }
            for (let i = 0; i < fieldsPairs.length; i += 1) {
                payload +=
                    (i === 0 ? ' ' : ',') + grammar.escape.tag(fieldsPairs[i][0]) + '=' + fieldsPairs[i][1];
            }
            if (timestamp !== undefined) {
                payload += ' ' + grammar.castTimestamp(timestamp, precision);
            }
        });
        return this._pool.discard({
            body: payload,
            method: 'POST',
            path: '/write',
            query: { db: database,
                p: this._options.password,
                precision,
                rp: retentionPolicy,
                u: this._options.username }
        });
    }
    /**
   * WriteMeasurement functions similarly to {@link InfluxDB#writePoints}, but
   * it automatically fills in the `measurement` value for all points for you.
   *
   * @param measurement
   * @param points
   * @param [options]
   * @return
   * @example
   * influx.writeMeasurement('perf', [
   *   {
   *     tags: { host: 'box1.example.com' },
   *     fields: { cpu: getCpuUsage(), mem: getMemUsage() },
   *   }
   * ])
   */
    writeMeasurement(measurement, points, options = {}) {
        points = points.map(p => (Object.assign({ measurement }, p)));
        return this.writePoints(points, options);
    }
    /**
   * .query() runs a query (or list of queries), and returns the results in a
   * friendly format, {@link IResults}. If you run multiple queries, an array of results
   * will be returned, otherwise a single result (array of objects) will be returned.
   *
   * @param query
   * @param [options]
   * @return result(s)
   * @example
   * influx.query('select * from perf').then(results => {
   *   console.log(results)
   * })
   */
    query(query, options = {}) {
        if (Array.isArray(query)) {
            query = query.join(';');
        }
        // If the consumer asked explicitly for nanosecond precision parsing,
        // remove that to cause Influx to give us ISO dates that
        // we can parse correctly.
        if (options.precision === 'n') {
            options = Object.assign({}, options); // Avoid mutating
            delete options.precision;
        }
        return this.queryRaw(query, options).then(res => results_1.parse(res, options.precision));
    }
    /**
   * QueryRaw functions similarly to .query() but it does no fancy
   * transformations on the returned data; it calls `JSON.parse` and returns
   * those results verbatim.
   *
   * @param query
   * @param [options]
   * @return
   * @example
   * influx.queryRaw('select * from perf').then(rawData => {
   *   console.log(rawData)
   * })
   */
    queryRaw(query, options = {}) {
        const { database = this._defaultDB(), retentionPolicy } = options;
        if (query instanceof Array) {
            query = query.join(';');
        }
        return this._pool.json(this._getQueryOpts({
            db: database,
            epoch: options.precision,
            q: query,
            rp: retentionPolicy
        }));
    }
    /**
   * Pings all available hosts, collecting online status and version info.
   * @param timeout Given in milliseconds
   * @return
   * @example
   * influx.ping(5000).then(hosts => {
   *   hosts.forEach(host => {
   *     if (host.online) {
   *       console.log(`${host.url.host} responded in ${host.rtt}ms running ${host.version})`)
   *     } else {
   *       console.log(`${host.url.host} is offline :(`)
   *     }
   *   })
   * })
   */
    ping(timeout) {
        return this._pool.ping(timeout);
    }
    /**
   * Returns the default database that queries operates on. It throws if called
   * when a default database isn't set.
   * @private
   */
    _defaultDB() {
        if (!this._options.database) {
            throw new Error('Attempted to run an influx query without a default' +
                ' database specified or an explicit database provided.');
        }
        return this._options.database;
    }
    /**
   * Creates options to be passed into the pool to query databases.
   * @private
   */
    _getQueryOpts(params, method = 'GET') {
        return {
            method,
            path: '/query',
            query: Object.assign({ p: this._options.password, u: this._options.username }, params)
        };
    }
}
exports.InfluxDB = InfluxDB;
