module.exports = (sequelize, DataTypes) => {
    return sequelize.define('PublicAlarm',{
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true
            }
        },
        content: {
            type: DataTypes.STRING,
            allowNull: false
        },
        linkUrl: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true
            }
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'public_alarm'
    });
}