const express = require('express');
const csv = require('csv-parser');
const fs = require('fs');
const axios = require('axios');
const redis = require("redis");
const { Parser } = require('json2csv');

const app = express();

const REDIS_PORT = process.env.PORT || 6379
const client = redis.createClient(6379)


const results = [];
fs.createReadStream('players.csv')
.pipe(csv())
.on('data', (data) => results.push(data))
.on('end', () => {
})

function getIdOfPlayer(main, player) {
    var id
    for (var i = 0; i < main.length; i++) {
        if (main[i].nickname === player) id = main[i].id
    }
    return id;
};


function fetchBall(req, res) {
    const player = req.params.player
    const id = getIdOfPlayer(results, player)
    axios
        .get(`https://www.balldontlie.io/api/v1/players/${id}`)
        .then(response => {
            var fields = []
            var table = [{ "id": id, "nickname": player }]
            if (response.data.first_name != null) {
                fields.push("first_name")
                table[0].first_name = response.data.first_name
            }
            if (response.data.last_name != null) {
                fields.push("last_name")
                table[0].last_name = response.data.last_name
            }
            if (response.data.height_feet != null) {
                fields.push("height_feet")
                table[0].height_feet = response.data.height_feet
            }
            if (response.data.height_inches != null) {
                fields.push("height_inches")
                table[0].height_inches = response.data.height_inches
            }
            if (response.data.position != null) {
                fields.push("position")
                table[0].position = response.data.position
            }
            //set Data to redis
            client.setex(id, 900, JSON.stringify(table[0]));
            const json2csvParser = new Parser({ fields });
            const csv = json2csvParser.parse(table)
            res.attachment("text/csv").send(csv);
        })
        .catch(error => {
            console.error(error)
        })
};

function cache(req, res, next) {
    const player = req.params.player
    const id = getIdOfPlayer(results, player)
    client.get(id, (err, data) => {
        if (err) throw err;
        if (data) {
          const fields = Object.keys(data);
          var table = [];
         table.push(data);
          const json2csvParser = new Parser({ fields });
            const csv = json2csvParser.parse(table)
           res.attachment("text/csv").send(csv);
        } else {
            next()
        }
    })
}

app.get('/:player', cache, fetchBall);


  app.listen(3000, ()=>{
    console.log(`Listening on port 3000`)
  });
