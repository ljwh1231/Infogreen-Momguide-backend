module.exports = (sequelize, DataTypes) => {
    return sequelize.define('PrivateAlarm',{
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
            allowNull: false
        },
        read: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        category: {
            type: DataTypes.STRING,
            allowNull: false
        },
        categoryIndex: {
            type: DataTypes.BIGINT,
            allowNull: false
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'private_alarm'
    });
}