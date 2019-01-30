module.exports = (sequelize, DataTypes) => {
    return sequelize.define('LivingIngredient', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        korName: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        engName: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        cas: {
            type: DataTypes.STRING,
            allowNull: true
        },
        use: {
            type: DataTypes.STRING,
            allowNull: true
        },
        ewg: {
            type: DataTypes.STRING,
            allowNull: true
        },
        toxicBreath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        toxicSkin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        toxicDev: {
            type: DataTypes.STRING,
            allowNull: true
        },
        toxicCancer: {
            type: DataTypes.STRING,
            allowNull: true
        },
        scoreBreath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        scoreSkin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        scoreDev: {
            type: DataTypes.STRING,
            allowNull: true
        },
        scoreCancer: {
            type: DataTypes.STRING,
            allowNull: true
        },
        harmness: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        dsl: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        epa: {
            type: DataTypes.STRING,
            allowNull: true
        },
        slsSles: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        ammonium: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },
        scent: {
            type: DataTypes.BOOLEAN,
            allowNull: true  
        },
        color: {
            type: DataTypes.BOOLEAN,
            allowNull: true  
        },
        humid: {
            type: DataTypes.BOOLEAN,
            allowNull: true  
        },
        remark: {
            type: DataTypes.STRING,
            allowNull: true
        },
        allergy: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echaBreath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echaSkin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echaDev: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echaCancer: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echaEye: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'living_ingredient'
    });
};