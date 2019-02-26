module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ProductAdditionalReview', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        date: {
            type: DataTypes.DATE,
            allowNull: false
        },
        content: {
            type: DataTypes.STRING,
            allowNull: false
        },
        ended: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'product_additional_review'
    })
};
