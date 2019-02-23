const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');
const moment = require('moment');
require('moment-timezone');

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
        });
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
    > 성분 공개 요청
    > POST /api/ask/requestIngredOpen
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no product": 해당 제품 없음
          "already open": 이미 성분 공개된 제품
          "product add failed": db에 해당 제품 등록 실패
          "unauthrized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 등록
      }
*/
router.post('/requestIngredOpen', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.LivingDB.findOne({
            where: {
                index: req.body.productIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no product"
                });
                return;
            } else {
                if (result.dataValues.ingredient === 'O') {
                    res.status(400).json({
                        error: "already open"
                    });
                    return;
                } else {
                    db.MemberToOpenRequest.create({
                        memberIndex: token.index,
                        productIndex: req.body.productIndex,
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
                }
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
    > 성분 공개 완료 후 요청 목록에서 삭제(이것은 유저가 하는것이 아니라 추후에 admin 계정이 있을 때 admin 권한으로 삭제하는것. 현재 admin의 유저 index는 1)
    > POST /api/ask/cancelIngredOpen
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.productIndex로 제품의 인덱스 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no product": 해당 제품 없이 없어 삭제 불가
          "update failure": 해당 제품의 상태를 성분 공개 상태로 바꾸는 데에 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.delete('/cancelIngredOpen', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (token.index !== 1) {
            res.status(403).json({
                error: "unauthorized request"
            });
            return;
        }

        db.MemberToOpenRequest.destroy({
            where: {
                productIndex: req.body.productIndex,
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no product"
                });
                return;
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
                        res.status(424).json({
                            error: "update failure"
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

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > 성분 공개 요청한 제품들 목록 받아오기
    > GET /api/ask/ingredOpen
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > erro: {
        "invalid request": 올바른 req가 전달되지 않음
        "unauthorized request": 권한 없는 사용자가 접근
    }
    > [
        결과를 배열로 전달(제품 정보 + 해당 제품을 성분 공개 요청한 사람 수도 numIngredOpen으로 추가됨)
      ]
*/
router.get('/ingredOpen', (req, res) => {
    let token = req.headers['authorization'];
    let finalResult = [];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberToOpenRequest.findAll({
            where: {
                memberIndex: token.index
            }
        }).then(async (result) => {
            for (let i=0; i<result.length; ++i) {
                await db.LivingDB.findOne({
                    where: {
                        index: result[i].dataValues.productIndex
                    }
                }).then(async (productInfo) => {
                    await db.MemberToOpenRequest.findAndCountAll({
                        where: {
                            productIndex: productInfo.dataValues.index
                        }
                    }).then((countInfo) => {
                        productInfo.dataValues.numIngredOpen = countInfo.count;
                        finalResult.push(productInfo.dataValues);
                    });
                });
            }

            res.json(finalResult);
            return;
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/* 
    > 해당 제품을 유저가 성분 공개 요청 했는지 확인
    > GET /api/ask/checkIngredOpen
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.productIndex로 해당 제품의 index 넣어주기
    > error: {
        "invalid request": 올바른 req가 전달되지 않음
        "unauthorized request": 권한 없는 사용자가 접근
    }
    > check {
        true(성분 공개 요청을 했음)
        false(성분 공개 요청을 하지 않음)
      }
*/
router.get('/checkIngredOpen', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberToOpenRequest.findOne({
            where: {
                memberIndex: token.index,
                productIndex: Number(req.query.productIndex)
            }
        }).then((result) => {
            if (!result) {
                res.json({
                    check: false
                });
                return;
            } else {
                res.json({
                    check: true
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
    > 해당 제품에 대해 성분 공개 요청한 사람들의 수
    > GET /api/ask/countIngredOpen?productIndex=1
    > req.query.productIndex에 해당 제품의 인덱스를 전달
    > erro: {
        "invalid request": 올바른 req가 전달되지 않음
        "count error": 해당하는 정보의 수를 세는 데에 문제가 발생함
    }
    > {
        totalNum: 사람 수
      }
*/
router.get('/countIngredOpen', (req, res) => {
    if (!req.query.productIndex) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.MemberToOpenRequest.findAndCountAll({
        where: {
            productIndex: Number(req.query.productIndex)
        }
    }).then((result) => {
        if (!result) {
            res.status(424).json({
                error: "count error"
            });
            return;
        } else {
            res.json({
                totalNum: result.count
            });
            return;
        }
    });
});

/*
    > 성분 분석 요청
    > POST /api/ask/requestIngredAnal
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목), isCosmetic(제품 종류. 화장품이면 true, 생활화학제품은 false), requestContent(요청내용)
    > 선택정보: requestFile(요청 제품 사진. 유저가 업로드하지 않으면 그냥 보내지 않기.)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "not today anymore": 오늘 이미 요청을 보냈기 때문에 더 보낼 수 없음
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "post add failed: 요청이 저장되지 않음
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > result: {
        db안에 생성된 요청정보가 전달
    } 
*/
router.post('/requestIngredAnal', formidable(), (req, res) => {
    let token = req.headers['authorization'];
    let nextIndex = 0;

    const params = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    moment.tz.setDefault("Asia/Seoul");
    reqObj = {};

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.fields.title || !req.fields.isCosmetic || !req.fields.requestContent) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const currentDate = moment().format('MMMM Do YYYY');
        
        db.IngredientAnalysis.findAll({
            limit: 1,
            where: {
                memberIndex: token.index
            },
            order: [[ 'created_at', 'DESC' ]]
        }).then((result) => {
            if (result.length > 0 && (moment(result[0].dataValues.created_at).format('MMMM Do YYYY') === currentDate)) {
                res.status(400).json({
                    error: "not today anymore"
                });
                return;
            } else {
                reqObj.memberIndex = token.index;
                reqObj.title = req.fields.title;
                reqObj.isCosmetic = req.fields.isCosmetic === 'true';
                reqObj.requestContent = req.fields.requestContent;

                db.IngredientAnalysis.findAll({
                    limit: 1,
                    where: {},
                    order: [[ 'created_at', 'DESC' ]]
                }).then((result) => {
                    if (result.length === 0) {
                        nextIndex = 1;
                    } else {
                        nextIndex = result[0].dataValues.index + 1;
                    }

                    if (!(typeof req.files.requestFile === 'undefined')) {
                        if (!(req.files.requestFile.type ===  'image/gif' 
                                || req.files.requestFile.type === 'image/jpg' 
                                || req.files.requestFile.type === 'image/png'
                                || req.files.requestFile.type === 'image/jpeg')) {
                            res.status(400).json({
                                error: "invalid file(image only)"
                            });
                            return;
                        } else {
                            params.Key = "ingredient-analysis-files/request-files/" + nextIndex.toString() + getExtension(req.files.requestFile.name);
                            params.Body = require('fs').createReadStream(req.files.requestFile.path);   
                        }
                    } else {
                        params.Key = "NO";
                        params.Body = "NO";
                    }
                    
                    if (!(params.Key === "NO") && !(params.Key === "NO")) {
                        reqObj.requestFileUrl = config.s3Url + params.Key;
                    }

                    db.IngredientAnalysis.create(reqObj).done((result) => {
                        if (!result) {
                            res.status(424).json({
                                error: "post add failed"
                            });
                            return;
                        } else {
                            if (!(params.Key === "NO") && !(params.Key === "NO")) {
                                s3.putObject(params, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 store failed"
                                        });
                                        return;
                                    } else {
                                        res.json(result);
                                        return;
                                    }
                                });
                            } else {
                                res.json(result);
                                return;
                            }
                        }
                    });
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
    > 성분 분석 요청 수정
    > PUT /api/ask/editIngredAnal?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일. 수정하고자 하는 요청의 index를 req.query.index로 전달
    > 필수정보: title(포스트 제목), isCosmetic(제품 종류. 화장품이면 true, 생활화학제품은 false), requestContent(요청내용)
    > 선택정보: requestFile(요청 제품 사진. 유저가 업로드하지 않으면 그냥 보내지 않기. 제품 사진이 있었는데 없애는 경우도 프론트에서 사진 없앤 후 api에는 사진을 안 보내면 됨.)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/editIngredAnal', formidable(), (req, res) => {
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

    reqObj = {};

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.IngredientAnalysis.findOne({
            where: {
                index: Number(req.query.index),
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                if (result.dataValues.responseContent !== null) {
                    res.status(424).json({
                        error: "already responsed"
                    });
                    return;
                } else {
                    if (!req.fields.title || !req.fields.isCosmetic || !req.fields.requestContent) {
                        res.status(400).json({
                            error: "invalid request"
                        });
                        return;
                    }

                    reqObj.title = req.fields.title;
                    reqObj.isCosmetic = req.fields.isCosmetic === 'true';
                    reqObj.requestContent = req.fields.requestContent;

                    if (!(typeof req.files.requestFile === 'undefined')) {
                        if (!(req.files.requestFile.type ===  'image/gif' 
                                || req.files.requestFile.type === 'image/jpg' 
                                || req.files.requestFile.type === 'image/png'
                                || req.files.requestFile.type === 'image/jpeg')) {
                            res.status(400).json({
                                error: "invalid file(image only)"
                            });
                            return;
                        } else {
                            addParams.Key = "ingredient-analysis-files/request-files/" + Number(req.query.index).toString() + getExtension(req.files.requestFile.name);
                            addParams.Body = require('fs').createReadStream(req.files.requestFile.path);
                            reqObj.requestFileUrl = config.s3Url + addParams.Key;   
                        }
                    } else {
                        addParams.Key = "NO";
                        addParams.Body = "NO";
                        reqObj.requestFileUrl = null;
                    }

                    if (result.dataValues.requestFileUrl !== null) {
                        deleteParams.Key = "ingredient-analysis-files/request-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.requestFileUrl);
                    } else {
                        deleteParams.Key = "NO";
                    }

                    db.IngredientAnalysis.update(
                        reqObj,
                        {
                            where: {
                                index: Number(req.query.index),
                                memberIndex: token.index
                            }
                        }
                    ).then((result) => {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
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
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                    return;
                                } else {
                                    if (addParams.Key === 'NO') {
                                        res.json({
                                            success: true
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
                                                res.json({
                                                    success: true
                                                });
                                                return;
                                            }
                                        });
                                    }
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
    });
});

/*
    > 성분 분석 요청 삭제
    > DELETE /api/ask/cancelIngredAnal?index=1
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 수정하고자 하는 요청의 index를 req.query.index로 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": db에 해당 요청이 존재하지 않음
          "s3 delete failed": s3 버켓 안의 파일 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근 
      }
    > success: {
        true: 성공적으로 삭제
      }
*/
router.delete('/cancelIngredAnal', (req, res) => {
    let token = req.headers['authorization'];

    const requestParams = {
        Bucket: 'infogreenmomguide',
        Key: null
    };

    const responseParams = {
        Bucket: 'infogreenmomguide',
        Key: null
    };

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.IngredientAnalysis.findOne({
            where: {
                index: Number(req.query.index),
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                if (result.dataValues.requestFileUrl !== null) {
                    requestParams.Key = "ingredient-analysis-files/request-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.requestFileUrl);
                } else {
                    requestParams.Key = "NO";
                }

                if (result.dataValues.responseFileUrl !== null) {
                    responseParams.Key = "ingredient-analysis-files/response-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.responseFileUrl);
                } else {
                    responseParams.Key = "NO";
                }

                db.IngredientAnalysis.destroy({
                    where: {
                        index: Number(req.query.index),
                        memberIndex: token.index
                    }
                }).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                        return;
                    } else {
                        if (requestParams.Key == "NO") {
                            if (responseParams.Key == "NO") {
                                res.json({
                                    success: true
                                });
                                return;
                            } else {
                                s3.deleteObject(responseParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 delete failed"
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
                        } else {
                            s3.deleteObject(requestParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                    return;
                                } else {
                                    if (responseParams.Key == "NO") {
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    } else {
                                        s3.deleteObject(responseParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 delete failed"
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
                                }
                            });
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
    });
});

/*
    > 성분 분석 요청 목록 불러오기
    > GET /api/ask/ingredAnal
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > []: 빈 배열. 검색 결과 없음.
      error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > [
        결과를 배열로 전달
      ]
*/
router.get('/ingredAnal', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.IngredientAnalysis.findAll({
            where: {
                memberIndex: token.index
            }
        }).then((result) => {
            res.json(result);
            return;
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > admin이 유저가 요청한 성분 분석 포스트에 답변을 작성/수정(새로 작성하는 경우나 수정하는 경우 동일하므로 api 통일.)
    > PUT /api/ask/responseIngredAnal?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일. 수정하고자 하는 요청의 index를 req.query.index로 전달
    > 필수정보: responseContent(답변 내용)
    > 선택정보: responseFile(admin이 답변과 함께 첨부하는 파일. 업로드하지 않으면 그냥 보내지 않기, 파일이 있었는데 없애는 경우에도 보내지 않기)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 해당 요청은 존재하지 않음
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/responseIngredAnal', formidable(), (req, res) => {
    let token = req.headers['authorization'];
    const resObj = {};

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

    decodeToken(res, token).then((token) => {
        
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (token.index !== 1) {
            res.status(403).json({
                error: "unauthorized request"
            });
            return;
        }

        if (!req.fields.responseContent || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        resObj.responseContent = req.fields.responseContent;

        db.IngredientAnalysis.findOne({
            where: {
                index: Number(req.query.index)
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                if (!(typeof req.files.responseFile === 'undefined')) {
                    addParams.Key = "ingredient-analysis-files/response-files/" + Number(req.query.index).toString() + getExtension(req.files.responseFile.name);
                    addParams.Body = require('fs').createReadStream(req.files.responseFile.path);
                    resObj.responseFileUrl = config.s3Url + addParams.Key;
                } else {
                    addParams.Key = "NO";
                    addParams.Body = "NO";
                    resObj.responseFileUrl = null;
                }

                if (result.dataValues.responseFileUrl !== null) {
                    deleteParams.Key = "ingredient-analysis-files/response-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.responseFileUrl);
                } else {
                    deleteParams.Key = "NO";
                }

                db.IngredientAnalysis.update(
                    resObj,
                    {
                        where: {
                            index: Number(req.query.index)
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                        return;
                    } else {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
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
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                    return;
                                } else {
                                    if (!(addParams.Key === 'NO' && addParams.Body === 'NO')) {
                                        s3.putObject(addParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 store failed"
                                                });
                                                return;
                                            } else {
                                                res.json({
                                                    success: true
                                                });
                                                return;
                                            }
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    }
                                }
                            });
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
    });
});

/*
    > 1:1 문의하기
    > POST /api/ask/questionOneToOne
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: questionContent(문의내용)
    > 선택정보: questionFile(문의 관련 사진. 유저가 업로드하지 않으면 그냥 보내지 않기.)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "post add failed: 요청이 저장되지 않음
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > result: {
        db안에 생성된 요청정보가 전달
    } 
*/
router.post('/questionOneToOne', formidable(), (req, res) => {
    let token = req.headers['authorization'];
    let nextIndex = 0;

    const params = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    queObj = {};

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.fields.questionContent) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        queObj.memberIndex = token.index;
        queObj.questionContent = req.fields.questionContent;

        db.OneToOneQuestion.findAll({
            limit: 1,
            where: {},
            order: [[ 'created_at', 'DESC' ]]
        }).then((result) => {
            if (result.length === 0) {
                nextIndex = 1;
            } else {
                nextIndex = result[0].dataValues.index + 1;
            }

            if (!(typeof req.files.questionFile === 'undefined')) {
                if (!(req.files.questionFile.type ===  'image/gif' 
                        || req.files.questionFile.type === 'image/jpg' 
                        || req.files.questionFile.type === 'image/png'
                        || req.files.questionFile.type === 'image/jpeg' )) {
                    res.status(400).json({
                        error: "invalid file(image only)"
                    });
                    return;
                } else {
                    params.Key = "one-to-one-question-files/question-files/" + nextIndex.toString() + getExtension(req.files.questionFile.name);
                    params.Body = require('fs').createReadStream(req.files.questionFile.path);   
                }
            } else {
                params.Key = "NO";
                params.Body = "NO";
            }
            
            if (!(params.Key === "NO") && !(params.Key === "NO")) {
                queObj.questionFileUrl = config.s3Url + params.Key;
            }

            db.OneToOneQuestion.create(queObj).done((result) => {
                if (!result) {
                    res.status(424).json({
                        error: "post add failed"
                    });
                    return;
                } else {
                    if (!(params.Key === "NO") && !(params.Key === "NO")) {
                        s3.putObject(params, (err, data) => {
                            if (err) {
                                res.status(424).json({
                                    error: "s3 store failed"
                                });
                                return;
                            } else {
                                res.json(result);
                                return;
                            }
                        });
                    } else {
                        res.json(result);
                        return;
                    }
                }
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
    > 1:1 문의 수정
    > PUT /api/ask/editOneToOne?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일. 수정하고자 하는 요청의 index를 req.query.index로 전달
    > 필수정보: questionContent(문의내용)
    > 선택정보: questionFile(문의 관련 사진. 유저가 업로드하지 않으면 그냥 보내지 않기. 사진이 있었는데 없애는 경우도 프론트에서 사진 없앤 후 api에는 사진을 안 보내면 됨.)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/editOneToOne', formidable(), (req, res) => {
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

    queObj = {};

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.OneToOneQuestion.findOne({
            where: {
                index: Number(req.query.index),
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                if (result.dataValues.answerContent !== null) {
                    res.status(424).json({
                        error: "already answered"
                    });
                    return;
                } else {
                    if (!req.fields.questionContent) {
                        res.status(400).json({
                            error: "invalid request"
                        });
                        return;
                    }

                    queObj.questionContent = req.fields.questionContent;

                    if (!(typeof req.files.questionFile === 'undefined')) {
                        if (!(req.files.questionFile.type ===  'image/gif' 
                                || req.files.questionFile.type === 'image/jpg' 
                                || req.files.questionFile.type === 'image/png'
                                || req.files.questionFile.type === 'image/jpeg')) {
                            res.status(400).json({
                                error: "invalid file(image only)"
                            });
                            return;
                        } else {
                            addParams.Key = "one-to-one-question-files/question-files/" + Number(req.query.index).toString() + getExtension(req.files.questionFile.name);
                            addParams.Body = require('fs').createReadStream(req.files.questionFile.path);
                            queObj.questionFileUrl = config.s3Url + addParams.Key;   
                        }
                    } else {
                        addParams.Key = "NO";
                        addParams.Body = "NO";
                        queObj.questionFileUrl = null;
                    }

                    if (result.dataValues.questionFileUrl !== null) {
                        deleteParams.Key = "one-to-one-question-files/question-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.questionFileUrl);
                    } else {
                        deleteParams.Key = "NO";
                    }

                    db.OneToOneQuestion.update(
                        queObj,
                        {
                            where: {
                                index: Number(req.query.index),
                                memberIndex: token.index
                            }
                        }
                    ).then((result) => {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
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
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                    return;
                                } else {
                                    if (addParams.Key === 'NO') {
                                        res.json({
                                            success: true
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
                                                res.json({
                                                    success: true
                                                });
                                                return;
                                            }
                                        });
                                    }
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
    });
});

/*
    > 1:1 문의 삭제
    > DELETE /api/ask/cancelOneToOne?index=1
    > res.headers에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. 삭제하고자 하는 요청의 index를 req.query.index로 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": db에 해당 요청이 존재하지 않음
          "s3 delete failed": s3 버켓 안의 파일 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근 
      }
    > success: {
        true: 성공적으로 삭제
      }
*/
router.delete('/cancelOneToOne', (req, res) => {
    let token = req.headers['authorization'];

    const questionParams = {
        Bucket: 'infogreenmomguide',
        Key: null
    };

    const answerParams = {
        Bucket: 'infogreenmomguide',
        Key: null
    };

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.OneToOneQuestion.findOne({
            where: {
                index: Number(req.query.index),
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                if (result.dataValues.questionFileUrl !== null) {
                    questionParams.Key = "one-to-one-question-files/question-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.questionFileUrl);
                } else {
                    questionParams.Key = "NO";
                }

                if (result.dataValues.answerFileUrl !== null) {
                    answerParams.Key = "one-to-one-question-files/answer-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.answerFileUrl);
                } else {
                    answerParams.Key = "NO";
                }

                db.OneToOneQuestion.destroy({
                    where: {
                        index: Number(req.query.index),
                        memberIndex: token.index
                    }
                }).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                        return;
                    } else {
                        if (questionParams.Key == "NO") {
                            if (answerParams.Key == "NO") {
                                res.json({
                                    success: true
                                });
                                return;
                            } else {
                                s3.deleteObject(answerParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 delete failed"
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
                        } else {
                            s3.deleteObject(questionParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                    return;
                                } else {
                                    if (answerParams.Key == "NO") {
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    } else {
                                        s3.deleteObject(answerParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 delete failed"
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
                                }
                            });
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
    });
});

/*
    > 1:1 문의 불러오기
    > GET /api/ask/oneToOne
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > []: 빈 배열. 검색 결과 없음.
      error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > [
        결과를 배열로 전달
      ]
*/
router.get('/oneToOne', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.OneToOneQuestion.findAll({
            where: {
                memberIndex: token.index
            }
        }).then((result) => {
            res.json(result);
            return;
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
        return;
    });
});

/*
    > admin이 유저가 요청한 1:1 문의에 답변을 작성/수정(새로 작성하는 경우나 수정하는 경우 동일하므로 api 통일.)
    > PUT /api/ask/answerOneToOne?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일. 수정하고자 하는 문의의 index를 req.query.index로 전달
    > 필수정보: answerContent(답변 내용)
    > 선택정보: answerFile(admin이 답변과 함께 첨부하는 파일. 업로드하지 않으면 그냥 보내지 않기, 파일이 있었는데 없애는 경우에도 보내지 않기)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 해당 요청은 존재하지 않음
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/answerOneToOne', formidable(), (req, res) => {
    let token = req.headers['authorization'];
    const ansObj = {};

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

    decodeToken(res, token).then((token) => {
        
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (token.index !== 1) {
            res.status(403).json({
                error: "unauthorized request"
            });
            return;
        }

        if (!req.fields.answerContent || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        ansObj.answerContent = req.fields.answerContent;

        db.OneToOneQuestion.findOne({
            where: {
                index: Number(req.query.index)
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                if (!(typeof req.files.answerFile === 'undefined')) {
                    addParams.Key = "one-to-one-question-files/answer-files/" + Number(req.query.index).toString() + getExtension(req.files.answerFile.name);
                    addParams.Body = require('fs').createReadStream(req.files.answerFile.path);
                    ansObj.answerFileUrl = config.s3Url + addParams.Key;
                } else {
                    addParams.Key = "NO";
                    addParams.Body = "NO";
                    ansObj.answerFileUrl = null;
                }

                if (result.dataValues.answerFileUrl !== null) {
                    deleteParams.Key = "one-to-one-question-files/answer-files/" + Number(req.query.index).toString() + getExtension(result.dataValues.answerFileUrl);
                } else {
                    deleteParams.Key = "NO";
                }

                db.OneToOneQuestion.update(
                    ansObj,
                    {
                        where: {
                            index: Number(req.query.index)
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                        return;
                    } else {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
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
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                    return;
                                } else {
                                    if (!(addParams.Key === 'NO' && addParams.Body === 'NO')) {
                                        s3.putObject(addParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 store failed"
                                                });
                                                return;
                                            } else {
                                                res.json({
                                                    success: true
                                                });
                                                return;
                                            }
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                        return;
                                    }
                                }
                            });
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
    });
});

module.exports = router;