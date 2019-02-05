module.exports = (sequelize, DataTypes) => {
    return sequelize.define('MemberInfo', {
        index: {
            type: DataTypes.BIGINT,
            allowNull: false,
            autoIncrement: true,
            primaryKey: true
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                is: ["^[A-Za-z0-9+]*$", "i"],
                len: [6, 15],
            }
        },
        photoUrl: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isUrl: true
            }
        },
        nickName: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                len: [0, 6]
            }
        },
        gender: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                isIn: [['male', 'female']]
            }
        },
        memberAge: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                isIn: [[10, 20, 30, 40]]
            }
        },
        childBirthYear: {
            type: DataTypes.INTEGER,
            allowNUll: false,
        },
        childBirthMonth: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
                max: 12
            }
        },
        name: {
            type: DataTypes.STRING,
        },
        phoneNum: {
            type: DataTypes.STRING,
            validate: {
                isNumeric: true,
                len: [10, 11]
            }
        },
        addressRoad: {
            type: DataTypes.STRING,
        },
        addressLotNum: {
            type: DataTypes.STRING,
        },
        addressSpec: {
            type: DataTypes.STRING,
        },
        rank: {
            type: DataTypes.STRING,
            defaultValue: 'E',
            validate: {
                len: [1]
            }
        },
        point: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
        },
        salt: { // for encryting
            type: DataTypes.STRING
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'member_info'
    })
};