module.exports = (sequelize, DataTypes) => {
    return sequelize.define('cosmetic_ingredient', {
        name: {
            type: DataTypes.STRING,
            unique: true,
            primaryKey: true
        },
        diff_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        eng_name: {
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
        ewg_data: {
            type: DataTypes.STRING,
            allowNull: true
        },
        ewg_code: {
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
        }  
    })
};