module.exports = (sequelize, DataTypes) => {
    return sequelize.define('MemberToOpenRequest', {
        memberIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        },
        productIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'member_to_open_request'
    })
};