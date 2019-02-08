module.exports = (sequelize, DataTypes) => {
    return sequelize.define('MemberToCosmetic', {
        memberIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        },
        cosmeticIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        },
        isHome: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            primaryKey: true
        },
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'member_to_cosmetic'
    })
};