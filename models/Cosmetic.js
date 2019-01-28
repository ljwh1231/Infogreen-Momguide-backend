module.exports = (sequelize, DataTypes) => {
    return sequelize.define('cosmetic', {
        index: {
            type: DataTypes.INTEGER,
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
        view_num: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        rate_count: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        rate_sum: {
            type: DataTypes.INTEGER,
            allowNull: false,
        }
    })
};