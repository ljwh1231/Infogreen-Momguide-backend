const config = require('../config/config');

const Sequelize = require('sequelize');
const sequelize = new Sequelize(
    config.databaseName,
    config.databaseID,
    config.databasePassword,
    {
        host: 'localhost',
        dialect: 'mysql',
        pool: {
            max: 20,
            min: 0,
            acquire: 5000,
            idle: 5000
        },
        define: {
            charset: 'utf8',
            dialectOptions: {
                collate: 'utf8_general_ci'
            }
        }
    }
);
const CosmeticIngredient = require('./CosmeticIngredient')(sequelize, Sequelize);
const CosmeticDB = require('./Cosmetic')(sequelize, Sequelize);
const LivingIngredient = require('./LivingIngredient')(sequelize, Sequelize);
const LivingDB = require('./Living')(sequelize, Sequelize);
const CosmeticIngredientToProduct = require('./CosmeticIngredientToProduct')(sequelize, Sequelize);
const LivingIngredientToProduct = require('./LivingIngredientToProduct')(sequelize, Sequelize);

CosmeticIngredient.belongsToMany(CosmeticDB, { through: CosmeticIngredientToProduct });
CosmeticDB.belongsToMany(CosmeticIngredient, { through: CosmeticIngredientToProduct });
CosmeticIngredientToProduct.belongsTo(CosmeticDB);
CosmeticIngredientToProduct.belongsTo(CosmeticIngredient);
LivingIngredient.belongsToMany(LivingDB, { through: LivingIngredientToProduct });
LivingDB.belongsToMany(LivingIngredient, { through: LivingIngredientToProduct });
LivingIngredientToProduct.belongsTo(LivingDB);
LivingIngredientToProduct.belongsTo(LivingIngredient);

module.exports = {
    CosmeticIngredient,
    CosmeticDB,
    CosmeticIngredientToProduct,
    LivingIngredient,
    LivingDB,
    LivingIngredientToProduct,
    sequelize
};