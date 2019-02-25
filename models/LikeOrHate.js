module.exports = (sequelize, DataTypes) => {
    return sequelize.define('LikeOrHate',{
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        like: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'like_or_hate'
    });
}