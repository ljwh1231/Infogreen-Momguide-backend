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
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password: {
            type: DataTypes.STRING,
            allowNull: false
        },
        photoUrl: {
            type: DataTypes.STRING,
            defaultValue: null,
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
        memberBirthYear: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        memberBirthMonth: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        memberBirthDay: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        hasChild: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        childBirthYear: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        childBirthMonth: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        childBirthDay: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },
        mailed: {
            type: DataTypes.BOOLEAN,
            allowNull: false
        },
        name: {
            type: DataTypes.STRING,
            defaultValue: null
        },
        phoneNum: {
            type: DataTypes.STRING,
            validate: {
                isNumeric: true,
                len: [10, 11]
            },
            defaultValue: null
        },
        addressRoad: {
            type: DataTypes.STRING,
            defaultValue: null
        },
        addressLotNum: {
            type: DataTypes.STRING,
            defaultValue: null
        },
        addressSpec: {
            type: DataTypes.STRING,
            defaultValue: null
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
        followingNum: { // 해당 유저가 팔로잉하고 있는 유저 수
            type: DataTypes.BIGINT,
            defaultValue: 0
        },
        followedNum: { // 해당 유저를 팔로잉하고 있는 유저수
            type: DataTypes.BIGINT,
            defaultValue: 0
        }
    }, {
        underscored: true,
        freezeTableName: true,
        tableName: 'member_info'
    })
};