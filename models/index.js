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
const MemberInfo = require('./MemberInfo')(sequelize, Sequelize);

CosmeticIngredient.belongsToMany(CosmeticDB, { through: 'cosmetic_ingredient_to_product' });
CosmeticDB.belongsToMany(CosmeticIngredient, { through: 'cosmetic_ingredient_to_product' });
LivingIngredient.belongsToMany(LivingDB, { through: 'living_ingredient_to_product' });
LivingDB.belongsToMany(LivingIngredient, { through: 'living_ingredient_to_product' });

MemberInfo.belongsToMany(MemberInfo, { as: 'follower', foreignKey: 'followee', through: 'follower_to_followee' });
MemberInfo.belongsToMany(MemberInfo, { as: 'followee', foreignKey: 'follower', through: 'follower_to_followee' });

const MemberToHome = require('./MemberToHome')(sequelize, Sequelize);
const MemberToLike = require('./MemberToLike')(sequelize, Sequelize);

const MemberToOpenRequest = require('./MemberToOpenRequest')(sequelize, Sequelize);
const IngredientAnalysis = require('./IngredientAnalysis')(sequelize, Sequelize);
const OneToOneQuestion = require('./OneToOneQuestion')(sequelize, Sequelize);

module.exports = {
    CosmeticIngredient,
    CosmeticDB,
    LivingIngredient,
    LivingDB,
    MemberInfo,
    MemberToHome,
    MemberToLike,
    MemberToOpenRequest,
    IngredientAnalysis,
    OneToOneQuestion,
    sequelize
};