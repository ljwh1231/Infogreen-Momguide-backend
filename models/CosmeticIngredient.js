module.exports = (sequelize, DataTypes) => {
    return sequelize.define('CosmeticIngredient', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING,
        },
        diffName: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        engName: {
            type: DataTypes.STRING,
            allowNull: true
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
        ewgData: {
            type: DataTypes.STRING,
            allowNull: true
        },
        ewgCode: {
            type: DataTypes.STRING,
            allowNull: true
        },
        allergic: {
            type: DataTypes.STRING,
            allowNull: true
        },
        breath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        skin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        dev: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cancer: {
            type: DataTypes.STRING,
            allowNull: true
        },
        eye: {
            type: DataTypes.STRING,
            allowNull: true
        },
        caution: {
            type: DataTypes.STRING,
            allowNull: true
        },
        remarks: {
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
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'cosmetic_ingredient'
    });
};