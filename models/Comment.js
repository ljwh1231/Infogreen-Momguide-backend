module.exports = (sequelize, DataTypes) => {
    return sequelize.define('Comment',{
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        content: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        parentIndex: {
            type: DataTypes.BIGINT,
            defaultValue: null
        },
        likeNum: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        hateNum: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        isReported: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'comment'
    });
}