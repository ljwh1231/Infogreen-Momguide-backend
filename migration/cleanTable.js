const model = require('../models');
/*
model.sequelize.cosmetic_ingredient_to_product.destroy({
    where: {}
})
model.sequelize.living_ingredient_to_product.destroy({
    where: {}
})
*/
model.LivingDB.destroy({
    where: {}
}).then(() => process.exit())
model.CosmeticDB.destroy({
    where: {}
}).then(() => process.exit())
model.CosmeticIngredient.destroy({
    where: {}
}).then(() => process.exit())
model.LivingIngredient.destroy({
    where: {}
}).then(() => process.exit())
