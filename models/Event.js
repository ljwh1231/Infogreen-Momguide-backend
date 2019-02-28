module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Event',{
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: false
        },
        subtitle: {
            type: DataTypes.STRING,
            allowNull: false
        },
        content: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: ""
        },
        titleImageUrl: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true
            }
        },
        contentImageUrl: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true
            }
        },
        expirationDate: {
            type: DataTypes.DATE,
            defaultValue: null,
            validate: {
                isDate: true
            }
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'event'
    });
}