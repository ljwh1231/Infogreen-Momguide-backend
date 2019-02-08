module.exports = (sequelize, DataTypes) => {
    return sequelize.define('MemberToLiving', {
        memberIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        },
        livingIndex: {
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
        tableName: 'member_to_living'
    })
};