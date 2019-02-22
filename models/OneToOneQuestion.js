module.exports = (sequelize, DataTypes) => {
    return sequelize.define('OneToOneQuestion', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        memberIndex: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        questionContent: {
            type: DataTypes.STRING,
            allowNull: false
        },
        questionFileUrl: {
            type: DataTypes.STRING,
            defaultValue: null,
            validate: {
                isUrl: true
            }
        },
        answerContent: {
            type: DataTypes.STRING,
            defaultValue: null
        },
        answerFileUrl: {
            type: DataTypes.STRING,
            defaultValue: null,
            validate: {
                isUrl: true
            }
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'one_to_one_question'
    })
};