module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Cosmetic', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        brand: {
            type: DataTypes.STRING,
            allowNull: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        viewNum: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        rateCount: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        rateSum: {
            type: DataTypes.INTEGER,
            allowNull: false,
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'cosmetic'
    })
};