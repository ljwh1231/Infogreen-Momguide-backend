var Sequelize = require('sequelize');
var sequelize = new Sequelize(
    'Infogreen-Momguide-backend',
    'user1',
    'abcd1234',
    {
        'host': 'localhost',
        'dialect': 'mysql'
    }
);
var CosmeticIngredient = require('./CosmeticIngredient');
var CosmeticDB = require('./CosmeticDB');
var LivingIngredient = require('./LivingIngredient');
var LivingDB = require('./LivingDB');

CosmeticIngredient.belongsToMany(CosmeticDB, { through: 'CosmeticIngredientToProduct' });
CosmeticDB.belongsToMany(CosmeticIngredient, { through: 'CosmeticIngredientToProduct' });
LivingIngredient.belongsToMany(LivingDB, { through: 'LivingIngredientToProduct' });
LivingDB.belongsToMany(LivingIngredient, { through: 'LivingIngredientToProduct' });

module.exports = db;