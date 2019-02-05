const express = require("express");
const router = express.Router();

const db = require("../../models/index");
const Op = db.sequelize.Op;