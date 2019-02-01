module.exports = (sequelize, DataTypes) => {
    return sequelize.define('CosmeticIngredientToProducts', {
        cosmetic_ingredient_index: {
            type: DataTypes.BIGINT,
            primaryKey: true
        },
        cosmetic_index: {
            type: DataTypes.BIGINT,
            primaryKey: true
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'c_i_to_p'
    })   
}