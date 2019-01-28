const config = require('../config/config');

const Sequelize = require('sequelize');
const sequelize = new Sequelize(
    config.databaseName,
    config.databaseID,
    config.databasePassword,
    {
        'host': 'localhost',
        'dialect': 'mysql'
    }
);
const CosmeticIngredient = require('./CosmeticIngredient')(sequelize, Sequelize);
const CosmeticDB = require('./Cosmetic')(sequelize, Sequelize);
const LivingIngredient = require('./LivingIngredient')(sequelize, Sequelize);
const LivingDB = require('./Living')(sequelize, Sequelize);

CosmeticIngredient.belongsToMany(CosmeticDB, { through: 'CosmeticIngredientToProduct' });
CosmeticDB.belongsToMany(CosmeticIngredient, { through: 'CosmeticIngredientToProduct' });
LivingIngredient.belongsToMany(LivingDB, { through: 'LivingIngredientToProduct' });
LivingDB.belongsToMany(LivingIngredient, { through: 'LivingIngredientToProduct' });

module.exports = {
    CosmeticIngredient,
    CosmeticDB,
    LivingIngredient,
    LivingDB,
    sequelize
};