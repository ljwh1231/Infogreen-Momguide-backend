const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const mailReq = require("superagent");

const db = require("../../models/index");

const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');

const config = require('../../config/config');

const mailchimpInstance   = 'us20';
const listUniqueId        = '654054dea8';
const mailchimpApiKey     = 'e6efd62eda528273f5473ef9254f8e53-us20';

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

// async function to find one in product db
async function findProduct(prevResult) {
    let returnArray = [[], []];

    for (let i=0; i<prevResult.length; ++i) {
        if (prevResult[i].dataValues.isCosmetic) {
            await db.CosmeticDB.findOne({
                where: {
                    index: prevResult[i].dataValues.productIndex
                }
            }).then((result) => {
                returnArray[0].push(result.dataValues);
            });
        } else {
            await db.LivingDB.findOne({
                where: {
                    index: prevResult[i].dataValues.productIndex
                }
            }).then((result) => {
                returnArray[1].push(result.dataValues);
            });
        }
    }
    return returnArray;
}

/*
    > 회원가입
    > POST /api/auth/register
    > form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: email(이메일), password(비밀번호), nickName(닉네임), gender(성별), memberBirthYear(회원생년), memberBirthMonth(회원생월), memberBirthDay(회원생일),
      hasChild(자녀여부), mailed(홍보메일수신여부)
    > 필수/선택정보(hasChild가 true일 경우엔 필수로 받기. 아니면 받지 않기.): childBirthYear(자식생년), childBirthMonth(자식생월), childBirthDay(자식생일)
    > 선택정보: name(이름), phoneNum(휴대폰번호 - "-" 빼고 숫자로만 이루어진 string으로), postalCode(우편번호), addressRoad(도로명 주소), addressSpec(상세주소),
      addressEtc(참고주소)
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
            || !req.fields.memberBirthDay || !req.fields.hasChild || !req.fields.mailed) {
            
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
    infoObj.hasChild = req.fields.hasChild === 'true';
    infoObj.mailed = req.fields.mailed === 'true';

    if (infoObj.hasChild === true) {
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

    if (req.fields.postalCode) {
        infoObj.postalCode = req.fields.postalCode;
    }

    if (req.fields.addressRoad) {
        infoObj.addressRoad = req.fields.addressRoad;
    }

    if (req.fields.addressSpec) {
        infoObj.addressSpec = req.fields.addressSpec;
    }

    if (req.fields.addressEtc) {
        infoObj.addressEtc = req.fields.addressEtc;
    }

    mailReq.post('https://' + mailchimpInstance + '.api.mailchimp.com/3.0/lists/' + listUniqueId + '/members/')
        .set('Content-Type', 'application/json;charset=utf-8')
        .set('Authorization', 'Basic ' + new Buffer('any:' + mailchimpApiKey ).toString('base64'))
        .send({
          'email_address': infoObj.email,
          'status': (infoObj.mailed) ? 'subscribed' : 'unsubscribed'
        }).end((err, response) => {
            if (response.status < 300 || (response.status === 400 && response.body.title === "Member Exists")) {
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
            } else {
              res.status(400).send("invalid request");
            }
        });
});

/*
    > 이메일 중복 확인
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
    > 닉네임 중복 확인
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
    > 로그인
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
    > 회원정보 가져오기(팔로잉/팔로우는 추후에)
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
            },
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

/*
    > 우리집 화장품 등록
    > POST /api/auth/addHomeCosmetic
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > mainCategory: true
    > 400: invalid request
      403: unauthorized access
*/
router.post('/addHomeCosmetic', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToHome.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: true
        }).done((err, result) => {
            if (err) {
                res.json(err);
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        console.log(error);
        res.status(403).send("unauthorized request");
        return;
    });
});

/*
    > 우리집 생활화학제품 등록 
    > POST /api/auth/addHomeLiving
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > isCosmetic: true로 전달
    > 400: invalid request
      403: unauthorized access
*/
router.post('/addHomeLiving', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToHome.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: false
        }).done((err, result) => {
            if (err) {
                res.json(err);
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});


/*
    > 우리집 화장품 취소 
    > DELETE /api/auth/cancelHomeCosmetic
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > isCosmetic: true로 전달
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
*/
router.delete('/cancelHomeCosmetic', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToHome.destroy({
            where: {
                memberIndex: token.index,
                productIndex: req.body.productIndex,
                isCosmetic: true
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no info"
                })
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});


/*
    > 우리집 생활화학제품 취소 
    > POST /api/auth/cancelHomeLiving
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > isCosmetic: false로 전달
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
*/
router.delete('/cancelHomeLiving', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToHome.destroy({
            where: {
                memberIndex: token.index,
                productIndex: req.body.productIndex,
                isCosmetic: false
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no info"
                })
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});


/*
    > 찜 화장품 등록
    > POST /api/auth/addLikeCosmetic
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > isCosmetic: true로 등록
    > 400: invalid request
      403: unauthorized access
*/
router.post('/addLikeCosmetic', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToLike.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: true
        }).done((err, result) => {
            if (err) {
                res.json(err);
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});

/*
    > 찜 생활화학제품 등록 
    > POST /api/auth/addLikeLiving
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > isCosmetic: false로 전달
    > 400: invalid request
      403: unauthorized access
*/
router.post('/addLikeLiving', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToLike.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: false
        }).done((err, result) => {
            if (err) {
                res.json(err);
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});


/*
    > 찜 화장품 취소 
    > DELETE /api/auth/cancelLikeCosmetic
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > isCosmetic: true로 전달
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
*/
router.delete('/cancelLikeCosmetic', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToLike.destroy({
            where: {
                memberIndex: token.index,
                productIndex: req.body.productIndex,
                isCosmetic: true
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no info"
                })
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});


/*
    > 찜 생활화학제품 취소 
    > DELETE /api/auth/cancelLikeLiving
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 클릭한 제품의 index를 req.body로 전달
    > isCosmetic: false로 전달
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
*/
router.delete('/cancelLikeLiving', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToLike.destroy({
            where: {
                memberIndex: token.index,
                productIndex: req.body.productIndex,
                isCosmetic: false
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no info"
                })
            }
            else {
                res.json(result);
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});



// 회원정보 받는거 수정(팔로잉/팔로워)

// 구글
// 카카오
// 네이버

/*
    > 우리집 화학제품 불러오기 
    > get /api/auth/info/homeProduct
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > 결과를 두 배열을 가지고 있는 배열 하나로 전달. 첫번째 배열은 화장품, 두번째 배열은 화학제품. 각 배열에 해당 제품들의 정보 객체들이 있음.
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
*/
router.get('/info/homeProduct', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToHome.findAll({
            where: {
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.json([]);
            } else {
                findProduct(result).then((finalResult) => {
                    res.json(finalResult);
                });
            }
        });
    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

/*
    > 찜한 제품 불러오기 
    > get /api/auth/info/likeProduct
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > 결과를 두 배열을 가지고 있는 배열 하나로 전달. 첫번째 배열은 화장품, 두번째 배열은 화학제품. 각 배열에 해당 제품들의 정보 객체들이 있음.
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
*/
router.get('/info/likeProduct', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }

        db.MemberToLike.findAll({
            where: {
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.json([]);
            } else {
                findProduct(result).then((finalResult) => {
                    res.json(finalResult);
                });
            }
        });
    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

// 비밀번호 찾기(이메일 전송)
router.post('/edit/passwordRequest', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }
        
    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

// 리뷰

// 회원정보 수정
router.put('/edit', formidable(), (req, res) => {
    let token = req.headers['token'];

    const params = {
        Bucket: 'infogreenmomguide',
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    decodeToken(token).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }
        
        

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

module.exports = router;