const express = require("express");
const bodyParser = require("body-parser");
const passport = require("passport");

const models = require("./models");
const sequelize = models.sequelize;
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const port = 1234;
sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log('Express server listening on port ' + port);
    });
});
