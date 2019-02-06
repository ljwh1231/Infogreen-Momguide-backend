const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const db = require("../../models/index");
const Op = db.sequelize.Op;

const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');

const config = require('../../config/config');

// function to get extension in filename
function getExtension(fileName) {
    var list = fileName.split('.');
    return '.' + list[list.length-1];
}

/*
    > POST /api/auth/register
    > form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > photoUrl 대신 image를 직접 파일로 전달. memberAge, childBirthYear, childBirthMonth는 셀렉트 박스에서 받은 그대로 전달
      주소는 api로 도로명, 지번, 상세 세 가지로 나눠 받음. 휴대폰 번호는 '-' 생략하여 번호로만 이루어진 string으로.
    > 400: invalid request
      412: precondition unsatisfied
*/
router.post('/register', formidable(), (req, res) => {

    const params = {
        Bucket: 'infogreenmomguide',
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    const infoObj = {};

    if (!req.fields.email || !req.fields.password || !req.files.image
            || !req.fields.nickName || !req.fields.gender || !req.fields.memberAge
            || !req.fields.childBirthYear || !req.fields.childBirthMonth) {
            
        res.status(400).send("invalid request");
        return;
    }

    infoObj.email = req.fields.email;

    if (req.fields.password.length > 15 || req.fields.password.length < 6) {
        res.status(412).send("precondition unsatisfied");
        return;
    }

    infoObj.nickName = req.fields.nickName;
    infoObj.gender = req.fields.gender;
    infoObj.memberAge = Number(req.fields.memberAge);

    infoObj.childBirthYear = Number(req.fields.childBirthYear);
    infoObj.childBirthMonth = Number(req.fields.childBirthMonth);

    if (req.fields.name) {
        infoObj.name = req.fields.name;
    }

    if (req.fields.phoneNum) {
        infoObj.phoneNum = req.fields.phoneNum;
    }

    if (req.fields.addressRoad) {
        infoObj.addressRoad = req.fields.addressRoad;
    }

    if (req.fields.addressLotNum) {
        infoObj.addressLotNum = req.fields.addressLotNum;
    }

    if (req.fields.addressSpec) {
        infoObj.addressSpec = req.fields.addressSpec;
    }
    
    bcrypt.genSalt(10, (err, salt) => {
        if (err) {
            console.log(err);
        } else {
            bcrypt.hash(req.fields.password, salt, null, (err, hash) => {
                if (err) {
                    console.log(err);
                } else {
                    infoObj.password = hash;

                    params.Key = "profile-images/" + infoObj.email + getExtension(req.files.image.name);
                    params.Body = require('fs').createReadStream(req.files.image.path);
                    s3.putObject(params, function(err, data) {
                        if (err) {
                            console.log(err)
                        } else {
                            console.log("Successfully uploaded data to myBucket/myKey");
                            infoObj.photoUrl = "https://s3.ap-northeast-2.amazonaws.com/infogreenmomguide/" + params.Key;

                            db.MemberInfo.create(
                                infoObj
                            ).done(function(err, result) {
                                if (err) {
                                    res.json(err);
                                }
                                else {
                                    res.json(result);
                                }
                            });
                        }
                    });
                }
            });
        }
    });

});

/*
    > GET /api/auth/register/:email
    > req.params.email로 email을 전달
    > isDuplicated: {
        true: 중복된 이메일이 존재
        false: 중복된 이메일이 존재하지 않음
      }
*/
router.get('/register/:email', (req, res) => {

    db.MemberInfo.findOne({
        where: { email: req.params.email }
    }).then((result) => {
        if (!result) {
            res.json({
                isDuplicated: false
            });
        } else {
            res.json({
                isDuplicated: true
            });
        }
    })
    
});

/*
    > POST /api/auth/login
    > json 형태로 req.body.email과 req.body.password를 받음
    > json 안의 tokenData로 토큰을 전달
    > 400: invalid request
      error: {
          "no member": 해당 email이 디비에 없음. 회원가입이 되어 있지 않은 이메일
          "incorrect password": 해당 password의 해시와 디비에 저장된 해시가 일치하지 않음. 잘못된 비밀번호
      }
*/
router.post('/login', (req, res) => {

    if (!req.body.email || !req.body.password) {
        res.status(400).send("invalid request");
        return;
    }

    db.MemberInfo.findOne({
        where: {
            email: req.body.email,
        }
    }).then((result) => {
        if (!result) {
            res.json({
                error: "no member"
            });
        } else { 
            bcrypt.compare(req.body.password, result.password, (err, bcryptResult) => {
                if (err) {
                    console.log(err);
                } else {
                    if (bcryptResult) {
                        const payload = {
                            email: result.email,
                            nickName: result.nickName
                          };
                        const jwtSecret = config.jwtSecret;
                        const options = {expiresIn: 60*60*24};
                        
                        const token = jwt.sign(payload, jwtSecret, options);
                        
                        res.json({
                            tokenData: token
                        });

                    } else {
                        res.json({
                            error: "incorrect password"
                        });
                    }
                }
            })
        }
    })
});

// check login
// /api/auth/check
router.get('/check', (req, res) => {

});

// get member info
// /api/auth/info
router.get('/info', (req, res) => {

});

module.exports = router;