module.exports = (sequelize, DataTypes) => {
    return sequelize.define('ProductReviewImage', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        url: {
            type: DataTypes.STRING,
            allowNull: false
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'product_review_image'
    })
};
