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
        tableName: 'living'
    });
};