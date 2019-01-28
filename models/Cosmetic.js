module.exports = (sequelize, DataTypes) => {
    return sequelize.define('cosmetic', {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            primaryKey: true
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