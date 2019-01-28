const express = require("express");
const seqeuelize = require("sequelize");
const bodyParser = require("body-parser");
const passport = require("passport");

const models = require("./models");
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

models.seqeuelize.sync().then(function() {
    app.listen(8000, function() {
        console.log('Express server listening on port ' + server.address().port);
    })
})