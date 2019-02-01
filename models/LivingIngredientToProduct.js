module.exports = (sequelize, DataTypes) => {
    return sequelize.define('LivingIngredientToProducts', {
        living_ingredient_index: {
            type: DataTypes.BIGINT,
            primaryKey: true
        },
        living_index: {
            type: DataTypes.BIGINT,
            primaryKey: true
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'l_i_to_p'
    })   
}