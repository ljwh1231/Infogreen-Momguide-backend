const model = require('../models');
model.LivingDB.destroy({
    where: {}
});
model.CosmeticDB.destroy({
    where: {}
});
model.CosmeticIngredient.destroy({
    where: {}
});
model.LivingIngredient.destroy({
    where: {}
});

model.sequelize.query('DELETE FROM cosmetic_ingredient_to_product', {
    type: model.sequelize.QueryTypes.DELETE
});
model.sequelize.query('DELETE FROM living_ingredient_to_product', {
    type: model.sequelize.QueryTypes.DELETE
});
