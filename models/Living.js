module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Living', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
            unique: true,
        },
        brand: {
            type: DataTypes.STRING,
            allowNull: true
        },
        madeBy: {
            type: DataTypes.STRING,
            allowNull: false
        },
        ingredient: {
            type: DataTypes.STRING,
            allowNull: true
        },
        testNum: {
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
        foreignCertificate: {
            type: DataTypes.STRING,
            allowNull: true
        },
        viewNum: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        rateCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        rateSum: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'living'
    });
};