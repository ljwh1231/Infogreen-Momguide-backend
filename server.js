const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const models = require("./models");
const sequelize = models.sequelize;
const app = express();

const scheduler = require('./script/timer');

app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(require('./routes'));

const port = 8080;
sequelize.sync().then(() => {
    app.listen(port, () => {
        console.log('Express server listening on port ' + port);
    });
});
