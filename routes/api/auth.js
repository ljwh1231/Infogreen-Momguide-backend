const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const db = require("../../models/index");

const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');

const config = require('../../config/config');

// function to get extension in filename
function getExtension(fileName) {
    var list = fileName.split('.');
    return '.' + list[list.length-1];
}

// function to decode user token
function decodeToken(token) {

    if (!token) {
        res.status(400).send("invalid request");
        return;
    }

    token = token.substring(7);

    const promise = new Promise(
        (resolve, reject) => {
            jwt.verify(token, config.jwtSecret, (err, decoded) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            })
        }
    );

    return promise;
}

/*
    > POST /api/auth/register
    > form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수로 전달해야하는 데이터는 email, password, nickName, gender, memberBirthYear, memberBirthMonth,memberBirthDay, hasChild
      나머지 정보는 있으면 각 이름에 맞게 넣어서 보내고 없으면 아예 객체에 추가하지 말기. hasChild가 true일 땐 childBirthYear, childBirthMonth, childBirthDay도
      필수로 보내기. false라면 자녀 생년 월일은 보내지 말기.
    > 주소는 주소 API 자체가 도로명 + 지번 + 상세로 되어있으므로 세 개를 각각 보내면 됨. 저 셋 중 하나가 없을 수도 있는데 없으면 넣지 말기.
      휴대전화번호는 '-' 생략하여 숫자로만 이루어진 string으로 보내기
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

    if (!req.fields.email || !req.fields.password || !req.fields.nickName 
            || !req.fields.gender || !req.fields.memberBirthYear || !req.fields.memberBirthMonth
            || !req.fields.memberBirthDay || !req.fields.hasChild) {
            
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
    infoObj.memberBirthYear = Number(req.fields.memberBirthYear);
    infoObj.memberBirthMonth = Number(req.fields.memberBirthMonth);
    infoObj.memberBirthDay = Number(req.fields.memberBirthDay);
    infoObj.hasChild = req.fields.hasChild;

    if (req.fields.hasChild === true) {
        if (!req.fields.childBirthYear || !req.fields.childBirthMonth || !req.fields.childBirthDay) {
            res.status(400).send("invalid request");
            return;
        } else {
            infoObj.childBirthYear = Number(req.fields.childBirthYear);
            infoObj.childBirthMonth = Number(req.fields.childBirthMonth);
            infoObj.childBirthDay = Number(req.fields.childBirthDay);
        }
    }

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

                    if (!(typeof req.files.image === 'undefined')) {
                        params.Key = "profile-images/" + infoObj.email + getExtension(req.files.image.name);
                        params.Body = require('fs').createReadStream(req.files.image.path);
                    } else {
                        params.Key = "NO";
                        params.Body = "NO";
                    }
                    s3.putObject(params, function(err, data) {
                        if (err) {
                            console.log(err)
                        } else {
                            if (!(params.Key === "NO") && !(params.Key === "NO")) {
                                infoObj.photoUrl = "https://s3.ap-northeast-2.amazonaws.com/infogreenmomguide/" + params.Key;
                            }

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
    > GET /api/auth/register/checkEmail?email=enflwodn@gmail.com
    > req.query.email로 email을 전달
    > 400: invalid request
      isDuplicated: {
        true: 중복된 이메일이 존재
        false: 중복된 이메일이 존재하지 않음
      }
*/
router.get('/register/checkEmail', (req, res) => {
    if (!req.query.email) {
        res.status(400).send("invalid request");
        return;
    }

    db.MemberInfo.findOne({
        where: { email: req.query.email }
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
    > GET /api/auth/register/checkNickName?nickName=Peace
    > req.query.nickName nickName 전달
    > 400: invalid request
      isDuplicated: {
        true: 중복된 닉네임이 존재
        false: 중복된 닉네임이 존재하지 않음
      }
*/
router.get('/register/checkNickName', (req, res) => {
    if (!req.query.nickName) {
        res.status(400).send("invalid request");
        return;
    }

    db.MemberInfo.findOne({
        where: { nickName: req.query.nickName }
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
                            index: result.index,
                            email: result.email,
                          };
                        const jwtSecret = config.jwtSecret;
                        const options = {expiresIn: 60*60*24};
                        
                        const token = jwt.sign(payload, jwtSecret, options);
                        
                        res.json({
                            token: token
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


/*
    > GET /api/auth/info
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것
    > db의 row가 json으로 넘어오니 필요한 정보를 받아 사용
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
*/
router.get('/info', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no info"
                });
            } else {
                res.json(result);
            }
        });
    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

// 팔로우 신청
// 팔로우 해제
// 팔로워 수 누르면 팔로워 목록
// 팔로잉 수 누르면 팔로잉 목록


router.post('/auth/addHomeCosmetic', (req, res) => {
    let token = req.headers['token'];

    
});

router.post('/auth/addHomeLiving', (req, res) => {

});

router.post('/auth/cancelHomeCosmetic', (req, res) => {

});

router.post('/auth/cancelHomeLiving', (req, res) => {

});

router.post('/auth/addHomeCosmetic', (req, res) => {

});

router.post('/auth/addHomeLiving', (req, res) => {

});

router.post('/auth/cancelHomeCosmetic', (req, res) => {

});

router.post('/auth/cancelHomeLiving', (req, res) => {

});


// 회원정보 받는거 수정(관심 상품 뜨게)
// 회원정보 받는거 수정(리뷰 뜨게)

// 구글
// 카카오
// 네이버

// 비밀번호 찾기

// 회원정보 수정

module.exports = router;