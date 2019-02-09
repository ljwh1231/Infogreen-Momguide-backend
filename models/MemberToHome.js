module.exports = (sequelize, DataTypes) => {
    return sequelize.define('MemberToHome', {
        memberIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        },
        productIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        },
        isCosmetic: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            primaryKey: true
        },
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'member_to_home'
    })
};