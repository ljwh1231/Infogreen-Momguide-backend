module.exports = (sequelize, DataTypes) => {
    return sequelize.define('IngredientAnalysis', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        memberIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        isCosmetic: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        requestContent: {
            type: DataTypes.STRING,
            allowNull: false
        },
        requestFileUrl: {
            type: DataTypes.STRING,
            defaultValue: null,
            validate: {
                isUrl: true
            }
        },
        responseContent: {
            type: DataTypes.STRING,
            defaultValue: null
        },
        responseFileUrl: {
            type: DataTypes.STRING,
            defaultValue: null,
            validate: {
                isUrl: true
            }
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'ingredient_analysis'
    })
};