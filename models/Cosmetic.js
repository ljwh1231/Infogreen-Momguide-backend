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
            allowNull: false,
            defaultValue: 0
        },
        rateSum: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        rateCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        includeHighDanger: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        includeMiddleDanger: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        includeCare: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'cosmetic'
    })
};