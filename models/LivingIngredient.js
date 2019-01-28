module.exports = (sequelize, DataTypes) => {
    return sequelize.define('LivingIngredient', {
        index: {
            type: DataTypes.INTEGER,
            allowNull: false,
            primaryKey: true,
            autoIncrement: true
        },
        kor_name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },
    
        eng_name: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
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
        toxic_breath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        toxic_skin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        toxic_dev: {
            type: DataTypes.STRING,
            allowNull: true
        },
        toxic_cancer: {
            type: DataTypes.STRING,
            allowNull: true
        },
        score_breath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        score_skin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        score_dev: {
            type: DataTypes.STRING,
            allowNull: true
        },
        score_cancer: {
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
        sls_sles: {
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
        echa_breath: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echa_skin: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echa_dev: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echa_cancer: {
            type: DataTypes.STRING,
            allowNull: true
        },
        echa_eye: {
            type: DataTypes.STRING,
            allowNull: true
        }
    })
}