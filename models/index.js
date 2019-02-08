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

MemberInfo.belongsToMany(MemberInfo, { as: 'follower', foreignKey: 'follower', through: 'follower_to_followee' });
MemberInfo.belongsToMany(MemberInfo, { as: 'followee', foreignKey: 'followee', through: 'follower_to_followee' });

MemberInfo.belongsToMany(CosmeticDB, { through: 'member_to_cosmetic_home' });
CosmeticDB.belongsToMany(MemberInfo, { through: 'member_to_cosmetic_home' });
MemberInfo.belongsToMany(LivingDB, { through: 'member_to_living_home' });
LivingDB.belongsToMany(MemberInfo, { through: 'member_to_living_home' });

MemberInfo.belongsToMany(CosmeticDB, { through: 'member_to_cosmetic_like' });
CosmeticDB.belongsToMany(MemberInfo, { through: 'member_to_cosmetic_like' });
MemberInfo.belongsToMany(LivingDB, { through: 'member_to_living_like' });
LivingDB.belongsToMany(MemberInfo, { through: 'member_to_living_like' });

module.exports = {
    CosmeticIngredient,
    CosmeticDB,
    LivingIngredient,
    LivingDB,
    MemberInfo,
    sequelize
};