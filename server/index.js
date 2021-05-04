const keys = require('./keys');

// Express App Setup
const express = require('express');
// const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.urlencoded({extended: true}));
app.use(express.json());

// Postgres Client Setup
const { Pool } = require('pg');
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort
});
pgClient.on('error', () => console.log('Lost connection to Postgres'));

pgClient.on('connect', (client) => {
    client.query('CREATE TABLE IF NOT EXISTS values(number INT)')
          .catch(err => console.log(err));
});

// Redis Client Setup
const redis = require('redis');
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    retry_strategy: () => 1000
})
const redisPublisher = redisClient.duplicate();

// Express route handlers
app.get('/', (req, res) => {
    res.send('Hi, shevo.');
});

app.get('/values/all', async(req, res) => {
    const values = await pgClient.query('SELECT * FROM values');
    res.send(values.rows);  // Send just the relevant info.
});

app.get('/values/current', async(req, res) => {
    // Since redis doesn't have out-of-the-box promise support,
    // we user callbacks.
    redisClient.hgetall('values', (err, values) => {
        res.send(values);
    })
});

app.post('/values', async(req, res) => {
    const index = req.body.index;

    // Just taking values under 40.
    if (parseInt(index) > 40) {
        return res.status(422).send("Please don't be that guy...");
    }

    redisClient.hset('values', index, 'Nothing yet...');
    // Call the worker!
    redisPublisher.publish('insert', index);
    // Insert the value into the PG db.
    pgClient.query('INSERT INTO values(number) VALUES($1)', [index]);
    res.send({ working: true });
});

app.listen(5000, err => {
    console.log('Listening');
});