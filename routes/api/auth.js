const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const mailReq = require("superagent");
const bcrypt = require('bcrypt-nodejs');
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');
const sgMail = require('@sendgrid/mail');

const db = require("../../models/index");
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
      error: {
          "salt generation failed": 솔트 생성 실패
          "hash generation failed": 해쉬 생성 실패
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "member creation failed": db안에 회원정보 생성 실패
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
                        res.json({
                            error: "salt generation failed"
                        })
                    } else {
                        bcrypt.hash(req.fields.password, salt, null, (err, hash) => {
                            if (err) {
                                res.json({
                                    error: "hash generation failed"
                                })
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
                                        res.json({
                                            error: "s3 store failed"
                                        });
                                    } else {
                                        if (!(params.Key === "NO") && !(params.Key === "NO")) {
                                            infoObj.photoUrl = config.s3Url + params.Key;
                                        }
                                        db.MemberInfo.create(
                                            infoObj
                                        ).done(function(err, result) {
                                            if (err) {
                                                res.json({
                                                    error: "member creation failed"
                                                });
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
      }
    > isDuplicated: {
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
      }
    > isDuplicated: {
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
    > 비밀번호 확인(프로필 수정 전에 확인)
    > GET /api/auth/editProfile/checkPassword?password=Ebubu1111
    > req.query.password에 password 전달
    > 400: invalid request
      403: unauthorized request
      error: {
        "no info": 해당 회원정보 없음
        "incorrect password": 비밀번호 일치하지 않음
      }
    > success: {
          true: 성공적으로 완료. 다음 단계로.
      }
*/
router.get('/editProfile/checkPassword', (req, res) => {
    let token = req.headers['token'];

    if (!req.query.password) {
        res.status(400).send("invalid request");
    }

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
                })
            } else {
                bcrypt.compare(req.query.password, result.password, (err, bcryptResult) => {
                    if (err) {
                        console.log(err);
                    } else {
                        if (bcryptResult) {
                            res.json({
                                success: bcryptResult
                            });
                        } else {
                            res.json({
                                error: "incorrect password"
                            });
                        }
                    }
                });
            }
        });
        
    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

/*
    > 로그인
    > POST /api/auth/login
    > req.body.email과 req.body.password에 각각 이메일과 비밀번호 전달
    > 400: invalid request
      error: {
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
                    res.json({
                        error: "hash comparison failed"
                    });
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
            });
        }
    })
});


/*
    > 회원정보 가져오기(팔로잉/팔로우는 추후에)
    > GET /api/auth/info
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것
    > 400: invalid request
      403: unauthorized access
      error: {
          "no info": 해당하는 정보의 유저가 없음(사실 로그인을 했다면 당연히 있겠지만)
      }
    > {
        해당 회원의 정보
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
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
      }
    > success: {
        true: 성공적으로 등록
      }
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
                res.json({
                    error: "product add failed"
                });
            }
            else {
                res.json({
                    success: true
                });
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});

/*
    > 우리집 생활화확제품 등록
    > POST /api/auth/addHomeLiving
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
      }
    > success: {
        true: 성공적으로 등록
      }
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
                res.json({
                    error: "product add failed"
                });
            }
            else {
                res.json({
                    success: true
                });
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
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "no such product": db에 해당 제품이 없어서 삭제 실패
      }
    > success: {
        true: 성공적으로 삭제
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
                    error: "no such product"
                })
            }
            else {
                res.json({
                    success: true
                });
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});


/*
    > 우리집 생활화학제품 취소
    > DELETE /api/auth/cancelHomeLiving
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "no such product": db에 해당 제품이 없어서 삭제 실패
      }
    > success: {
        true: 성공적으로 삭제
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
                    error: "no such product"
                })
            }
            else {
                res.json({
                    success: true
                });
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
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
      }
    > success: {
        true: 성공적으로 등록
      }
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
                res.json({
                    error: "product add failed"
                });
            }
            else {
                res.json({
                    success: true
                });
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
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "product add failed": db에 해당 제품을 추가하는데에 문제 발생
      }
    > success: {
        true: 성공적으로 등록
      }
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
                res.json({
                    error: "product add failed"
                });
            }
            else {
                res.json({
                    success: true
                });
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
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "no such product": db에 해당 제품이 없어서 삭제 실패
      }
    > success: {
        true: 성공적으로 삭제
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
                    error: "no such product"
                })
            }
            else {
                res.json({
                    success: true
                });
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
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "no such product": db에 해당 제품이 없어서 삭제 실패
      }
    > success: {
        true: 성공적으로 삭제
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
                    error: "no such product"
                })
            }
            else {
                res.json({
                    success: true
                });
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
    > GET /api/auth/info/homeProduct
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > 400: invalid request
      403: unauthorized access
      []: 빈 배열. 검색 결과 없음.
    > [
        []
        [] : 두 배열을 가진 배열로 리턴. 1번째 배열은 화장품, 2번째 배열은 생활화학제품들의 객체로 이루어짐.
      ]
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
    > 찜 화학제품 불러오기 
    > GET /api/auth/info/likeProduct
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > 400: invalid request
      403: unauthorized access
      []: 빈 배열. 검색 결과 없음.
    > [
        []
        [] : 두 배열을 가진 배열로 리턴. 1번째 배열은 화장품, 2번째 배열은 생활화학제품들의 객체로 이루어짐.
      ]
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
    });
});

/*
    > 비밀번호 변경을 위한 이메일 요청
    > POST /api/auth/editProfile/requestPassword
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.email로 email 전달.
    > 400: invalid request
      403: unauthorized access
      error: {
          "incorrect email": 적절하지 않은 이메일(가입시 입력한 이메일과 다름)
      }
    > success: {
        true: 성공적으로 이메일 전송
      }
    > 이메일에는 비밀번호 재설정 페이지 URL + 토큰이 전달됨. (현재는 임의의 URL을 넣어놓음. 추후에 변경 예정.)
*/
router.post('/editProfile/requestPassword', (req, res) => {
    let bearerToken = req.headers['token'];
    originalToken = bearerToken.substring(7);

    sgMail.setApiKey(config.sendgridApiKey);

    decodeToken(bearerToken).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }

        if (req.body.email === token.email) {
            const msg = {
                to: token.email,
                from: config.fromEmail,
                subject: 'Password Reset Verfication Email',
                text: 'Password Reset',
                html: '<a href="http://localhost:3000/passwordReset?token=' + originalToken + '">Password Reset</a>',
            };
    
            sgMail.send(msg);
            res.json({
                success: true
            });
        } else {
            res.json({
                error: "incorrect email"
            });
        }
        
    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

/*
    > 비밀번호 변경
    > PUT /api/auth/editProfile/resetPassword
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.password로 새로운 비밀번호 전달
    > 400: invalid request
      403: unauthorized access
      error: {
        "salt generation failed": 솔트 생성 실패
        "hash generation failed": 해쉬 생성 실패
        "update failed": db에 있는 정보 변경 실패
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/editProfile/resetPassword', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }
        
        bcrypt.genSalt(10, (err, salt) => {
            if (err) {
                res.json({
                    error: "salt generation failed"
                })
            } else {
                bcrypt.hash(req.body.password, salt, null, (err, hash) => {
                    if (err) {
                        res.json({
                            error: "hash generation failed"
                        })
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
                                res.json({
                                    error: "update failed"
                                });
                            } else {
                                res.json({
                                    success: true
                                });
                            }
                        });
                    }
                });
            }
        });
        
    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});

// 리뷰

/*
    > 회원정보 수정
    > PUT /api/auth/editProfile/edit
    > form data로 데이터 전달. 단, 이메일은 변경 불가이고 비밀번호는 변경 절차가 별도이므로 전달하지 않는다.
    > 필수정보: nickName(닉네임), gender(성별), memberBirthYear(회원생년), memberBirthMonth(회원생월), memberBirthDay(회원생일),
      hasChild(자녀여부)
    > 필수/선택정보(hasChild가 true일 경우엔 필수로 받기. 아니면 받지 않기.): childBirthYear(자식생년), childBirthMonth(자식생월), childBirthDay(자식생일)
    > 선택정보: name(이름), phoneNum(휴대폰번호 - "-" 빼고 숫자로만 이루어진 string으로), postalCode(우편번호), addressRoad(도로명 주소), addressSpec(상세주소),
      addressEtc(참고주소)
    > 400: invalid request
      403: unauthorized request
      error: {
          "no info": 회원정보 없음
          "s3 delete failed": s3 버켓 안에 있는 기존 프로필 사진 변경 실패
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "update failed": db 안에 있는 회원정보 변경 실패
      }
    > success: {
        true: 성공적으로 회원정보 변경
      }
*/
router.put('/editProfile/edit', formidable(), (req, res) => {
    let token = req.headers['token'];

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
        res.status(400).send("invalid request");
        return;
    }

    const infoObj = {};

    decodeToken(token).then((token) => {
        if (!token.index || !token.email) {
            res.status(400).send("invalid request");
            return;
        }
        
        infoObj.nickName = req.fields.nickName;
        infoObj.gender = req.fields.gender;
        infoObj.memberBirthYear = Number(req.fields.memberBirthYear);
        infoObj.memberBirthMonth = Number(req.fields.memberBirthMonth);
        infoObj.memberBirthDay = Number(req.fields.memberBirthDay);
        infoObj.hasChild = req.fields.hasChild === 'true';

        if (infoObj.hasChild === true) {
            if (!req.fields.childBirthYear || !req.fields.childBirthMonth || !req.fields.childBirthDay) {
                res.status(400).send("invalid request");
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
                email: token.email
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no info"
                })
            } else {
                deleteParams.Key = "profile-images/" + token.email + getExtension(result.dataValues.photoUrl);
                s3.deleteObject(deleteParams, (err, data) => {
                    if (err) {
                        res.json({
                            error: "s3 delete failed"
                        });
                    } else {
                        s3.putObject(addParams, (err, data) => {
                            if (err) {
                                res.json({
                                    error: "s3 store failed"
                                });
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
                                        res.json({
                                            error: "update failed"
                                        });
                                    }
                                    else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            }
                        });
                    }
                })
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    })
});

/*
    > 성분 공개 요청
    > POST /api/auth/requestIngredOpen
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달
    > 400: invalid request
      403: unauthorized access
      error: {
          "no product": 해당 제품 없음
          "already open": 이미 성분 공개된 제품
          "product add failed": db에 해당 제품 등록 실패
      }
    > success: {
        true: 성공적으로 등록
      }
*/
router.post('/requestIngredOpen', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        db.LivingDB.findOne({
            where: {
                index: req.body.productIndex
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no product"
                })
            } else {
                if (result.dataValues.ingredient === 'O') {
                    res.json({
                        error: "already open"
                    })
                } else {
                    db.MemberToOpenRequest.create({
                        memberIndex: token.index,
                        productIndex: req.body.productIndex,
                    }).done((err, result) => {
                        if (err) {
                            res.json({
                                error: "product add failed"
                            });
                        }
                        else {
                            res.json({
                                success: true
                            });
                        }
                    });
                }
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});

/*
    > 성분 공개 완료 후 요청 목록에서 삭제(이것은 유저가 하는것이 아니라 추후에 admin 계정이 있을 때 admin 권한으로 삭제하는것. 지금은 일단 아무 유저나 삭제 가능.)
    > POST /api/auth/ingredOpenRequest
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달
    > 400: invalid request
      403: unauthorized access
      error: {
          "no product": 해당 제품 없이 없어 삭제 불가
          "update failure": 해당 제품의 상태를 성분 공개 상태로 바꾸는 데에 실패
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.delete('/cancelIngredOpen', (req, res) => {
    let token = req.headers['token'];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !req.body.productIndex) {
            res.status(400).send("invalid request");
            return;
        }

        // token.index가 admin의 index인지 확인하는 작업 필요!

        db.MemberToOpenRequest.destroy({
            where: {
                productIndex: req.body.productIndex,
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    error: "no product"
                })
            }
            else {
                db.LivingDB.update({
                    ingredient: 'O'
                },
                {
                    where: {
                        index: req.body.productIndex
                    }
                }).then((result) => {
                    if (!result) {
                        res.json({
                            error: "update failure"
                        })
                    } else {
                        res.json({
                            success: true
                        });
                    }
                });
            }
        });

    }).catch((error) => {
        res.status(403).send("unauthorized request");
        return;
    });
});

// 성분 공개 요청 제품 목록

module.exports = router;