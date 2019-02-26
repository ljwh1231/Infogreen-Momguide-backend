module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ProductReview', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        rating: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        baseDate: {
            type: DataTypes.DATE,
            allowNull: false
        },
        content: {
            type: DataTypes.STRING(1100),
            allowNull: false
        },
        functionality: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        nonIrritating: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        sent: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        costEffectiveness: {
            type: DataTypes.INTEGER,
            allowNull: false,
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'product_review'
    })
};
