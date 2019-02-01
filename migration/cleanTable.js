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

model.CosmeticIngredientToProduct.destroy({
    where: {}
});
model.LivingIngredientToProduct.destroy({
    where: {}
});
