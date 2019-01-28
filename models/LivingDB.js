module.exports = (sequelize, DataTypes) => {
    return sequelize.define('LivingDB', {
        name: {
            type: DataTypes.STRING,
            unique: true,
            primaryKey: true
        },
        brand: {
            type: DataTypes.STRING,
            allowNull: true
        },
        made_by: {
            type: DataTypes.STRING,
            allowNull: false
        },
        ingredient: {
            type: DataTypes.STRING,
            allowNull: true
        },
        test_num: {
            type: DataTypes.STRING,
            allowNull: true
        },
        permit: {
            type: DataTypes.STRING,
            allowNull: true
        },
        eco: {
            type: DataTypes.STRING,
            allowNull: true
        },
        foreign_certificate: {
            type: DataTypes.STRING,
            allowNull: true
        },
        view_num: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        rate: {
            type: DataTypes.FLOAT,
            allowNull: false
        }
    })
}