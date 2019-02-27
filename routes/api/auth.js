const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const mailReq = require("superagent");
const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');
const sgMail = require('@sendgrid/mail');
const Sequelize = require('sequelize');

const db = require("../../models/index");
const config = require('../../config/config');

// function to get extension in filename
function getExtension(fileName) {
    const list = fileName.split('.');
    return '.' + list[list.length-1];
}

// function to decode user token
function decodeToken(res, token) {

    if (!token) {
        res.status(400).json({
            error: "invalid request"
        })
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
    let returnArray = [];

    for (let i=0; i<prevResult.length; ++i) {
        if (prevResult[i].dataValues.isCosmetic) {
            await db.CosmeticDB.findOne({
                where: {
                    index: prevResult[i].dataValues.productIndex
                }
            }).then((result) => {
                returnArray.push(result.dataValues);
            });
        } else {
            await db.LivingDB.findOne({
                where: {
                    index: prevResult[i].dataValues.productIndex
                }
            }).then((result) => {
                returnArray.push(result.dataValues);
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
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "precondition unsatisfied": value가 조건에 맞지 않음
          "salt generation failed": 솔트 생성 실패
          "hash generation failed": 해쉬 생성 실패
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "no file input": 파일이 전달되지 않음
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "member creation failed": db안에 회원정보 생성 실패
          "mailchimp registraion failed": 메일 침프에 정보 등록 실패
          "Validation error": db에 넣으려는 value가 조건에 맞지 않은 value
      }
    > result: {
        db안에 생성된 회원정보가 전달
    }
*/
router.post('/register', formidable(), (req, res) => {

    const params = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    const infoObj = {}; 

    if (!req.fields.email || !req.fields.password || !req.fields.nickName 
            || !req.fields.gender || !req.fields.memberBirthYear || !req.fields.memberBirthMonth
            || !req.fields.memberBirthDay || !req.fields.hasChild || !req.fields.mailed) {
            
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    infoObj.email = req.fields.email;

    if (req.fields.password.length > 15 || req.fields.password.length < 6 || req.fields.nickName.length > 6) {
        res.status(412).json({
            error: "precondition unsatisfied"
        });
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
            res.status(400).json({
                error: "invalid request"
            });
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

    mailReq.post('https://' + config.mailchimpInstance + '.api.mailchimp.com/3.0/lists/' + config.mailchimpListId + '/members/')
        .set('Content-Type', 'application/json;charset=utf-8')
        .set('Authorization', 'Basic ' + new Buffer('any:' + config.mailchimpApiKey ).toString('base64'))
        .send({
          'email_address': infoObj.email,
          'status': (infoObj.mailed) ? 'subscribed' : 'unsubscribed'
        }).end((err, response) => {
            if (response.status < 300 || (response.status === 400 && response.body.title === "Member Exists")) {
                bcrypt.genSalt(10, (err, salt) => {
                    if (err) {
                        res.status(424).json({
                            error: "salt generation failed"
                        });
                        return;
                    } else {
                        bcrypt.hash(req.fields.password, salt, null, (err, hash) => {
                            if (err) {
                                res.status(424).json({
                                    error: "hash generation failed"
                                })
                                return;
                            } else {
                                infoObj.password = hash;
            
                                if (!(typeof req.files.image === 'undefined')) {
                                    if (!(req.files.image.type ===  'image/gif' 
                                            || req.files.image.type === 'image/jpg' 
                                            || req.files.image.type === 'image/png'
                                            || req.files.image.type === 'image/jpeg')) {
                                        res.status(400).json({
                                            error: "invalid file(image only)"
                                        });
                                        return;
                                    } else {
                                        params.Key = "profile-images/" + infoObj.email + getExtension(req.files.image.name);
                                        params.Body = require('fs').createReadStream(req.files.image.path);
                                    }
                                } else {
                                    res.status(400).json({
                                        error: "no file input"
                                    });
                                    return;
                                }

                                s3.putObject(params, function(err, data) {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 store failed"
                                        });
                                        return;
                                    } else {
                                        infoObj.photoUrl = config.s3Url + params.Key;
                                        db.MemberInfo.create(
                                            infoObj
                                        ).catch(Sequelize.ValidationError, (err) => {
                                            if (err) {
                                                res.json({
                                                    error: "Validation error"
                                                });
                                                return;
                                            }
                                        }).then((result) => {
                                            if (!result) {
                                                res.status(424).json({
                                                    error: "member creation failed"
                                                });
                                                return;
                                            }
                                            else {
                                                res.json(result);
                                                return;
                                            }
                                        });
                                    }
                                });
                            }
                        });
                    }
                });
            } else {
                res.status(400).json({
                    error: "mailchimp registraion failed"
                });
                return;
            }
        });
});

/*
    > 이메일 중복 확인
    > GET /api/auth/register/checkEmail?email=enflwodn@gmail.com
    > req.query.email로 email을 전달
    > isDuplicated: {
        true: 중복된 이메일이 존재
      }
      error: {
          "invalid request": 올바른 req가 전달되지 않음
      }
    > isDuplicated: {
        false: 중복된 이메일이 존재하지 않음
      }
*/
router.get('/register/checkEmail', (req, res) => {
    if (!req.query.email) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.MemberInfo.findOne({
        where: { email: req.query.email }
    }).then((result) => {
        if (!result) {
            res.json({
                isDuplicated: false
            });
            return;
        } else {
            res.json({
                isDuplicated: true
            });
            return;
        }
    })
});

/*
    > 닉네임 중복 확인
    > GET /api/auth/register/checkNickName?nickName=Peace
    > req.query.nickName nickName 전달
    > isDuplicated: {
        true: 중복된 닉네임이 존재
      }
      error: {
          "invalid request": 올바른 req가 전달되지 않음
      }
    > isDuplicated: {
        false: 중복된 닉네임이 존재하지 않음
      }
*/
router.get('/register/checkNickName', (req, res) => {
    if (!req.query.nickName) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.MemberInfo.findOne({
        where: { nickName: req.query.nickName }
    }).then((result) => {
        if (!result) {
            res.json({
                isDuplicated: false
            });
            return;
        } else {
            res.json({
                isDuplicated: true
            });
            return;
       }
    })
});

/*
    > 비밀번호 확인(프로필 수정 전에 확인)
    > GET /api/auth/editProfile/checkPassword?password=Ebubu1111
    > header에 에 token을 넣어 전달. token 앞에 Bearer 붙일것. req.query.password에 password 전달
    > error: {
        "invalid request": 올바른 req가 전달되지 않음
        "no info": 해당 회원정보 없음
        "incorrect password": 비밀번호 일치하지 않음
        "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
          true: 성공적으로 완료. 다음 단계로.
      }
*/
router.get('/editProfile/checkPassword', (req, res) => {
    let token = req.headers['authorization'];

    if (!req.query.password) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no info"
                });
                return;
            } else {
                bcrypt.compare(req.query.password, result.password, (err, bcryptResult) => {
                    if (err) {
                        console.log(err);
                    } else {
                        if (bcryptResult) {
                            res.json({
                                success: bcryptResult
                            });
                            return;
                        } else {
                            res.status(403).json({
                                error: "incorrect password"
                            });
                            return;
                        }
                    }
                });
            }
        });
        
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    })
});

/*
    > 로그인
    > POST /api/auth/login
    > req.body.email과 req.body.password에 각각 이메일과 비밀번호 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no member": 해당 email이 디비에 없음. 회원가입이 되어 있지 않은 이메일
          "hash comparison failed": 해쉬 비교 과정에서 문제 발생
          "incorrect password": 해당 password의 해시와 디비에 저장된 해시가 일치하지 않음. 잘못된 비밀번호
      }
    > token: {
        token (token value를 전달)
      }
*/
router.post('/login', (req, res) => {

    if (!req.body.email || !req.body.password) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.MemberInfo.findOne({
        where: {
            email: req.body.email,
        }
    }).then((result) => {
        if (!result) {
            res.status(424).json({
                error: "no member"
            });
            return;
        } else { 
            bcrypt.compare(req.body.password, result.password, (err, bcryptResult) => {
                if (err) {
                    res.status(424).json({
                        error: "hash comparison failed"
                    });
                    return;
                } else {
                    if (bcryptResult) {
                        const payload = {
                            index: result.index,
                            email: result.email,
                            nickName: result.nickName
                          };
                        const jwtSecret = config.jwtSecret;
                        const options = {expiresIn: 60*60*24*14};
                        
                        const token = jwt.sign(payload, jwtSecret, options);
                        
                        res.json({
                            token: token
                        });
                        return;

                    } else {
                        res.status(403).json({
                            error: "incorrect password"
                        });
                        return;
                    }
                }
            });
        }
    })
});

/*
    > 토큰 재발급
    > POST /api/auth/refreshToken
    > req.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 해당 회원정보가 없음
          "unauthorized request": 권한 없는 사용자의 접근
      }
    > token: {
        token (token value를 전달)
      }
*/
router.post('/refreshToken', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such member"
                });
                return;
            } else {
                const payload = {
                    index: result.index,
                    email: result.email,
                    nickName: result.nickName
                  };
                const jwtSecret = config.jwtSecret;
                const options = {expiresIn: 60*60*24*14};
                
                const token = jwt.sign(payload, jwtSecret, options);

                res.json({
                    token: token
                });
                return;
            }
        });
        
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    })
});

/*
    > 회원정보 가져오기(팔로잉/팔로우는 추후에)
    > GET /api/auth/info
    > req.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > {
        해당 회원의 정보
      }
*/
router.get('/info', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }
        
        db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            },
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no info"
                });
                return;
            } else {
                res.json(result);
                return;
            }
        });
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
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
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
      }
    > success: {
        true: 성공적으로 등록
      }
*/
router.post('/addHomeCosmetic', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberToHome.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: true
        }).done((result) => {
            if (!result) {
                res.status(424).json({
                    error: "product add failed"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > 우리집 생활화확제품 등록
    > POST /api/auth/addHomeLiving
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 등록
      }
*/
router.post('/addHomeLiving', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberToHome.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: false
        }).done((result) => {
            if (!result) {
                res.status(424).json({
                    error: "product add failed"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});


/*
    > 우리집 화장품 취소
    > DELETE /api/auth/cancelHomeCosmetic
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such product": db에 해당 제품이 없어서 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근 
      }
    > success: {
        true: 성공적으로 삭제
      }
*/
router.delete('/cancelHomeCosmetic', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
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
                res.status(424).json({
                    error: "no such product"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});


/*
    > 우리집 생활화학제품 취소
    > DELETE /api/auth/cancelHomeLiving
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such product": db에 해당 제품이 없어서 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 삭제
      }
*/
router.delete('/cancelHomeLiving', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
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
                res.status(424).json({
                    error: "no such product"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});


/*
    > 찜 화장품 등록
    > POST /api/auth/addLikeCosmetic
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 등록
      }
*/
router.post('/addLikeCosmetic', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberToLike.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: true
        }).done((result) => {
            if (!result) {
                res.status(424).json({
                    error: "product add failed"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > 찜 생활화학제품 등록
    > POST /api/auth/addLikeLiving
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 등록
      }
*/
router.post('/addLikeLiving', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberToLike.create({
            memberIndex: token.index,
            productIndex: req.body.productIndex,
            isCosmetic: false
        }).done((result) => {
            if (!result) {
                res.status(424).json({
                    error: "product add failed"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});


/*
    > 찜 화장품 취소
    > DELETE /api/auth/cancelLikeCosmetic
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such product": db에 해당 제품이 없어서 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 삭제
      }
*/
router.delete('/cancelLikeCosmetic', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
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
                res.status(424).json({
                    error: "no such product"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});


/*
    > 찜 생활화학제품 취소
    > DELETE /api/auth/cancelLikeLiving
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such product": db에 해당 제품이 없어서 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 삭제
      }
*/
router.delete('/cancelLikeLiving', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
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
                res.status(424).json({
                    error: "no such product"
                });
                return;
            }
            else {
                res.json({
                    success: true
                });
                return;
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});



// 회원정보 받는거 수정(팔로잉/팔로워)

// 구글
// 카카오
// 네이버

/*
    > 우리집 제품 불러오기 
    > GET /api/auth/homeProduct?isCosmetic=true&page=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.isCosmetic으로 카테고리 전달.(true은 화장품, false는 생활화학제품),
      req.query.page로 페이지 넘버 전달
    > error: {
        "invalid request": 올바른 req가 전달되지 않음
        "unauthorized request": 권한 없는 사용자가 접근
    }
    > {
        Data: [] (제품 정보 배열)
        totalPages: 전체 페이지 수
      }
*/
router.get('/homeProduct', (req, res) => {
    let token = req.headers['authorization'];
    const isCosmetic = req.query.isCosmetic === 'true';

    let limit = 10;

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.query.isCosmetic || !req.query.page) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (isCosmetic) {
            db.MemberToHome.findAndCountAll({
                where: {
                    memberIndex: token.index,
                    isCosmetic: true
                }
            }).then((result) => {
                if (!result){
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                }
                let totalPages = Math.ceil(result.count/limit);
                db.MemberToHome.findAll({
                    where: {
                        memberIndex: token.index,
                        isCosmetic: true
                    },
                    limit: limit,
                    offset: limit * (Number(req.query.page)-1)
                }).then((result) => {
                    if (!result){
                        res.status(424).json({
                            error: "find error"
                        });
                        return;
                    } else {
                        findProduct(result).then((dataResult) => {
                            res.json({Data: dataResult, totalPages: totalPages});
                            return;
                        });
                    }
                });
            });
        } else {
            db.MemberToHome.findAndCountAll({
                where: {
                    memberIndex: token.index,
                    isCosmetic: false
                }
            }).then((result) => {
                if (!result){
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                }
                let totalPages = Math.ceil(result.count/limit);
                db.MemberToHome.findAll({
                    where: {
                        memberIndex: token.index,
                        isCosmetic: false
                    },
                    limit: limit,
                    offset: limit * (Number(req.query.page)-1)
                }).then((result) => {
                    if (!result){
                        res.status(424).json({
                            error: "find error"
                        });
                        return;
                    } else {
                        findProduct(result).then((dataResult) => {
                            res.json({Data: dataResult, totalPages: totalPages});
                            return;
                        });
                    }
                });
            });
        }
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    })
});

/*
    > 찜한 제품 불러오기 
    > GET /api/auth/likeProduct?isCosmetic=true&page=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.isCosmetic으로 카테고리 전달.(true은 화장품, false는 생활화학제품),
      req.query.page로 페이지 넘버 전달
    > error: {
        "invalid request": 올바른 req가 전달되지 않음
        "unauthorized request": 권한 없는 사용자가 접근
    }
    > {
        Data: [] (제품 정보 배열)
        totalPages: 전체 페이지 수
      }
*/
router.get('/likeProduct', (req, res) => {
    let token = req.headers['authorization'];
    const isCosmetic = req.query.isCosmetic === 'true';

    let limit = 10;

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.query.isCosmetic || !req.query.page) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (isCosmetic) {
            db.MemberToLike.findAndCountAll({
                where: {
                    memberIndex: token.index,
                    isCosmetic: true
                }
            }).then((result) => {
                if (!result){
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                }
                let totalPages = Math.ceil(result.count/limit);
                db.MemberToLike.findAll({
                    where: {
                        memberIndex: token.index,
                        isCosmetic: true
                    },
                    limit: limit,
                    offset: limit * (Number(req.query.page)-1)
                }).then((result) => {
                    if (!result){
                        res.status(424).json({
                            error: "find error"
                        });
                        return;
                    } else {
                        findProduct(result).then((dataResult) => {
                            res.json({Data: dataResult, totalPages: totalPages});
                            return;
                        });
                    }
                });
            });
        } else {
            db.MemberToLike.findAndCountAll({
                where: {
                    memberIndex: token.index,
                    isCosmetic: false
                }
            }).then((result) => {
                if (!result){
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                }
                let totalPages = Math.ceil(result.count/limit);
                db.MemberToLike.findAll({
                    where: {
                        memberIndex: token.index,
                        isCosmetic: false
                    },
                    limit: limit,
                    offset: limit * (Number(req.query.page)-1)
                }).then((result) => {
                    if (!result){
                        res.status(424).json({
                            error: "find error"
                        });
                        return;
                    } else {
                        findProduct(result).then((dataResult) => {
                            res.json({Data: dataResult, totalPages: totalPages});
                            return;
                        });
                    }
                });
            });
        }
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/* 
    > 해당 제품을 유저가 우리집/찜 제품으로 등록했는지 확인
    > GET /api/auth/checkHomeLike
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.productIndex에 제품 인덱스, req.query.isCosmetic에 제품 카테고리를 전달(화장품 true, 화학제품 false)
      error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > {
        home: true - 우리집 제품으로 등록되어 있음 / false - 우리집 제품으로 등록되어있지 않음
        like: true - 찜한 제품으로 등록되어 있음 / false - 찜한 제품으로 등록되어있지 않음
      }
*/
router.get('/checkHomeLike', (req, res) => {
    let token = req.headers['authorization'];
    let finalResult = {};

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const isCosmetic = req.query.isCosmetic === 'true';
        const productIndex = Number(req.query.productIndex);

        db.MemberToHome.findOne({
            where: {
                memberIndex: token.index,
                productIndex: productIndex,
                isCosmetic: isCosmetic
            }
        }).then((result) => {
            if (!result) {
                finalResult.home = false;
            } else {
                finalResult.home = true;
            }

            db.MemberToLike.findOne({
                where: {
                    memberIndex: token.index,
                    productIndex: productIndex,
                    isCosmetic: isCosmetic
                }
            }).then((result) => {
                if (!result) {
                    finalResult.like = false;
                } else {
                    finalResult.like = true;
                }

                res.json(finalResult);
                return;
            });
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});


/*
    > 비밀번호 변경을 위한 이메일 요청(로그인을 못 했을 시)
    > POST /api/auth/requestPassword
    > req.body.email로 email 전달.
    > error: {
          "incorrect email": 적절하지 않은 이메일(가입시 입력한 이메일과 다름)
      }
    > token: {
        token: 별도로 생성된 토큰 value가 전달되면 성공.
      }
    > 이메일에는 비밀번호 재설정 페이지 URL + ?토큰이 전달됨. (현재는 임의의 URL을 넣어놓음. 추후에 변경 예정.)
      response로 전달되는 token과 동일하므로 해당 URL로 연결.
*/
router.post('/requestPassword', (req, res) => {

    sgMail.setApiKey(config.sendgridApiKey);

    db.MemberInfo.findOne({
        where: {
            email: req.body.email
        }
    }).then((result) => {
        if (!result) {
            res.status(403).json({
                error: "incorrect email"
            });
            return;
        } else {
            
            const payload = {
                index: result.index,
                email: result.email,
                nickName: result.nickName
              };
            const jwtSecret = config.jwtSecret;
            const options = {expiresIn: 60*60*24};
            
            const token = jwt.sign(payload, jwtSecret, options);

            const msg = {
                to: req.body.email,
                from: config.fromEmail,
                subject: 'Password Reset Verfication Email',
                text: 'Password Reset',
                html: '<a href="http://localhost:3000/passwordReset?token=' + token + '">Password Reset</a>',
            };
    
            sgMail.send(msg);
            res.json({
                token: token
            });
            return;
        }
    });
});

/*
    > 비밀번호 변경
    > PUT /api/auth/editProfile/resetPassword
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.password로 새로운 비밀번호 전달
    > error: {
        "invalid request": 올바른 req가 전달되지 않음
        "salt generation failed": 솔트 생성 실패
        "hash generation failed": 해쉬 생성 실패
        "update failed": db에 있는 정보 변경 실패
        "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/editProfile/resetPassword', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }
        
        bcrypt.genSalt(10, (err, salt) => {
            if (err) {
                res.status(424).json({
                    error: "salt generation failed"
                });
                return;
            } else {
                bcrypt.hash(req.body.password, salt, null, (err, hash) => {
                    if (err) {
                        res.status(424).json({
                            error: "hash generation failed"
                        });
                        return;
                    } else {
    
                        db.MemberInfo.update({
                            password: hash
                        }, 
                        {
                            where: {
                                index: token.index
                            }
                        }).then((result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "update failed"
                                });
                                return;
                            } else {
                                res.json({
                                    success: true
                                });
                                return;
                            }
                        });
                    }
                });
            }
        });
        
    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > 회원정보 수정
    > PUT /api/auth/editProfile/edit
    > form data로 데이터 전달. 단, 이메일은 변경 불가이고 비밀번호는 변경 절차가 별도이므로 전달하지 않는다.
    > 필수정보: nickName(닉네임), gender(성별), memberBirthYear(회원생년), memberBirthMonth(회원생월), memberBirthDay(회원생일),
      hasChild(자녀여부), isImageChanged(프로필 사진 변경 여부)
    > 필수/선택정보(hasChild가 true일 경우엔 필수로 받기. 아니면 받지 않기.): childBirthYear(자식생년), childBirthMonth(자식생월), childBirthDay(자식생일)
    > 선택정보: name(이름), phoneNum(휴대폰번호 - "-" 빼고 숫자로만 이루어진 string으로), postalCode(우편번호), addressRoad(도로명 주소), addressSpec(상세주소),
      addressEtc(참고주소)
    > error: {
          "no info": 회원정보 없음
          "s3 delete failed": s3 버켓 안에 있는 기존 프로필 사진 변경 실패
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "update failed": db 안에 있는 회원정보 변경 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > token: {
        token (token value를 전달)
      }
*/
router.put('/editProfile/edit', formidable(), (req, res) => {
    let token = req.headers['authorization'];

    const addParams = {
        Bucket: 'infogreenmomguide',
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    const deleteParams = {
        Bucket: 'infogreenmomguide',
        Key: null
    };

    if (req.fields.email) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    const infoObj = {};

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }
        
        const index = token.index;
        const email = token.email;

        infoObj.nickName = req.fields.nickName;
        infoObj.gender = req.fields.gender;
        infoObj.memberBirthYear = Number(req.fields.memberBirthYear);
        infoObj.memberBirthMonth = Number(req.fields.memberBirthMonth);
        infoObj.memberBirthDay = Number(req.fields.memberBirthDay);
        infoObj.hasChild = req.fields.hasChild === 'true';

        const isImageChanged = req.fields.isImageChanged === 'true';

        if (infoObj.hasChild === true) {
            if (!req.fields.childBirthYear || !req.fields.childBirthMonth || !req.fields.childBirthDay) {
                res.status(400).json({
                    error: "invalid request"
                });
                return;
            } else {
                infoObj.childBirthYear = Number(req.fields.childBirthYear);
                infoObj.childBirthMonth = Number(req.fields.childBirthMonth);
                infoObj.childBirthDay = Number(req.fields.childBirthDay);
            }
        } else {
                infoObj.childBirthYear = 0;
                infoObj.childBirthMonth = 0;
                infoObj.childBirthDay = 0;
        }

        if (req.fields.name) {
            infoObj.name = req.fields.name;
        } else {
            infoObj.name = null;
        }

        if (req.fields.phoneNum) {
            infoObj.phoneNum = req.fields.phoneNum;
        } else {
            infoObj.phoneNum = null;
        }

        if (req.fields.postalCode) {
            infoObj.postalCode = req.fields.postalCode;
        } else {
            infoObj.postalCode = null;
        }

        if (req.fields.addressRoad) {
            infoObj.addressRoad = req.fields.addressRoad;
        } else {
            infoObj.addressRoad = null;
        }

        if (req.fields.addressSpec) {
            infoObj.addressSpec = req.fields.addressSpec;
        } else {
            infoObj.addressSpec = null;
        }

        if (req.fields.addressEtc) {
            infoObj.addressEtc = req.fields.addressEtc;
        } else {
            infoObj.addressEtc = null;
        }

        if (!(typeof req.files.image === 'undefined')) {
            addParams.Key = "profile-images/" + token.email + getExtension(req.files.image.name);
            addParams.Body = require('fs').createReadStream(req.files.image.path);
        } else {
            addParams.Key = "NO";
            addParams.Body = "NO";
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no info"
                });
                return;
            } else {
                if (!isImageChanged) {
                    db.MemberInfo.update(
                        infoObj,
                        {
                            where: {
                                index: token.index
                            }
                        }
                    ).then((result) => {
                        if (!result) {
                            res.status(424).json({
                                error: "update failed"
                            });
                            return;
                        }
                        else {
                            const payload = {
                                index: index,
                                email: email,
                                nickName: infoObj.nickName
                            };
                            const jwtSecret = config.jwtSecret;
                            const options = {expiresIn: 60*60*24*14};
                            
                            const token = jwt.sign(payload, jwtSecret, options);

                            res.json({
                                token: token
                            });
                            return;
                        }
                    });
                } else {
                    deleteParams.Key = "profile-images/" + token.email + getExtension(result.dataValues.photoUrl);
                    s3.deleteObject(deleteParams, (err, data) => {
                        if (err) {
                            res.status(424).json({
                                error: "s3 delete failed"
                            });
                            return;
                        } else {
                            s3.putObject(addParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 store failed"
                                    });
                                    return;
                                } else {
                                    if (!(addParams.Key === "NO") && !(addParams.Key === "NO")) {
                                        infoObj.photoUrl = "https://s3.ap-northeast-2.amazonaws.com/infogreenmomguide/" + addParams.Key;
                                    }
                                    db.MemberInfo.update(
                                        infoObj,
                                        {
                                            where: {
                                                index: token.index
                                            }
                                        }
                                    ).then((result) => {
                                        if (!result) {
                                            res.status(424).json({
                                                error: "update failed"
                                            });
                                            return;
                                        }
                                        else {
                                            const payload = {
                                                index: index,
                                                email: email,
                                                nickName: infoObj.nickName
                                            };
                                            const jwtSecret = config.jwtSecret;
                                            const options = {expiresIn: 60*60*24*14};
                                            
                                            const token = jwt.sign(payload, jwtSecret, options);

                                            res.json({
                                                token: token
                                            });
                                            return;
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            }
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    })
});

module.exports = router;