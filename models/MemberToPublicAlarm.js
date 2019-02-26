module.exports = (sequelize, DataTypes) => {
    return sequelize.define('MemberToPublicAlarm',{
        read: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'member_to_public_alarm'
    });
}