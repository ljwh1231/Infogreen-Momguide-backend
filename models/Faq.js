module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Faq',{
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
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: ""
        },
        imageUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isUrl: true
            }
        },
        contentUrl: {
            type: DataTypes.STRING,
            allowNull: true,
            validate: {
                isUrl: true
            }
        },
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'faq'
    });
}