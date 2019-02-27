module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Report',{
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        reason: {
            type: DataTypes.STRING,
            allowNull: false
        },
        reasonSpec: {
            type: DataTypes.STRING,
            defaultValue: null
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'report'
    });
}