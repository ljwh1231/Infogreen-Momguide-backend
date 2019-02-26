module.exports = (sequelize, DataTypes) => {
    return sequelize.define('PrivateAlarm',{
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'private_alarm'
    });
}