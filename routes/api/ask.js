const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');

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
        res.status(400).json({
            error: "invalid request"
        })
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        db.LivingDB.findOne({
            where: {
                index: req.body.productIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no product"
                })
            } else {
                if (result.dataValues.ingredient === 'O') {
                    res.status(400).json({
                        error: "already open"
                    })
                } else {
                    db.MemberToOpenRequest.create({
                        memberIndex: token.index,
                        productIndex: req.body.productIndex,
                    }).done((result) => {
                        if (!result) {
                            res.status(424).json({
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
        res.status(403).json({
            error: "unauthorized request"
        });
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.body.productIndex) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        if (token.index !== 1) {
            res.status(403).json({
                error: "unauthorized request"
            });
        }

        db.MemberToOpenRequest.destroy({
            where: {
                productIndex: req.body.productIndex,
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
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
                        res.status(424).json({
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
        res.status(403).json({
            error: "unauthorized request"
        });
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
        결과를 배열로 전달
      ]
*/
router.get('/ingredOpen', (req, res) => {
    let token = req.headers['authorization'];
    let finalResult = [];

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
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
                }).then((resultFound) => {
                    finalResult.push(resultFound.dataValues);
                });
            }

            res.json(finalResult);
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
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

    reqObj = {};

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        if (!req.fields.title || !req.fields.isCosmetic || !req.fields.requestContent) {
            res.status(400).json({
                error: "invalid request"
            });
        }

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
                } else {
                    if (!(params.Key === "NO") && !(params.Key === "NO")) {
                        s3.putObject(params, (err, data) => {
                            if (err) {
                                res.status(424).json({
                                    error: "s3 store failed"
                                });
                            } else {
                                res.json(result);
                            }
                        });
                    } else {
                        res.json(result);
                    }
                }
            });
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        db.IngredientAnalysis.findOne({
            where: {
                index: req.query.index,
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                if (result.dataValues.responseContent !== null) {
                    res.status(424).json({
                        error: "already responsed"
                    });
                } else {
                    if (!req.fields.title || !req.fields.isCosmetic || !req.fields.requestContent) {
                        res.status(400).json({
                            error: "invalid request"
                        });
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
                        } else {
                            addParams.Key = "ingredient-analysis-files/request-files/" + req.query.index.toString() + getExtension(req.files.requestFile.name);
                            addParams.Body = require('fs').createReadStream(req.files.requestFile.path);
                            reqObj.requestFileUrl = config.s3Url + addParams.Key;   
                        }
                    } else {
                        addParams.Key = "NO";
                        addParams.Body = "NO";
                        reqObj.requestFileUrl = null;
                    }

                    if (result.dataValues.requestFileUrl !== null) {
                        deleteParams.Key = "ingredient-analysis-files/request-files/" + req.query.index.toString() + getExtension(result.dataValues.requestFileUrl);
                    } else {
                        deleteParams.Key = "NO";
                    }

                    db.IngredientAnalysis.update(
                        reqObj,
                        {
                            where: {
                                index: req.query.index,
                                memberIndex: token.index
                            }
                        }
                    ).then((result) => {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
                                });
                            } else {
                                s3.putObject(addParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 store failed"
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                } else {
                                    if (addParams.Key === 'NO') {
                                        res.json({
                                            success: true
                                        });
                                    } else {
                                        s3.putObject(addParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 store failed"
                                                });
                                            } else {
                                                res.json({
                                                    success: true
                                                });
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        db.IngredientAnalysis.findOne({
            where: {
                index: req.query.index,
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                if (result.dataValues.requestFileUrl !== null) {
                    requestParams.Key = "ingredient-analysis-files/request-files/" + req.query.index.toString() + getExtension(result.dataValues.requestFileUrl);
                } else {
                    requestParams.Key = "NO";
                }

                if (result.dataValues.responseFileUrl !== null) {
                    responseParams.Key = "ingredient-analysis-files/response-files/" + req.query.index.toString() + getExtension(result.dataValues.responseFileUrl);
                } else {
                    responseParams.Key = "NO";
                }

                db.IngredientAnalysis.destroy({
                    where: {
                        index: req.query.index,
                        memberIndex: token.index
                    }
                }).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                    } else {
                        if (requestParams.Key == "NO") {
                            if (responseParams.Key == "NO") {
                                res.json({
                                    success: true
                                });
                            } else {
                                s3.deleteObject(responseParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 delete failed"
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(requestParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                } else {
                                    if (responseParams.Key == "NO") {
                                        res.json({
                                            success: true
                                        });
                                    } else {
                                        s3.deleteObject(responseParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 delete failed"
                                                });
                                            } else {
                                                res.json({
                                                    success: true
                                                });
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        db.IngredientAnalysis.findAll({
            where: {
                memberIndex: token.index
            }
        }).then((result) => {
            res.json(result);
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
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

    decodeToken(token).then((token) => {
        
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        if (token.index !== 1) {
            res.status(403).json({
                error: "unauthorized request"
            });
        }

        if (!req.fields.responseContent || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        resObj.responseContent = req.fields.responseContent;

        db.IngredientAnalysis.findOne({
            where: {
                index: req.query.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                if (!(typeof req.files.responseFile === 'undefined')) {
                    addParams.Key = "ingredient-analysis-files/response-files/" + req.query.index.toString() + getExtension(req.files.responseFile.name);
                    addParams.Body = require('fs').createReadStream(req.files.responseFile.path);
                    resObj.responseFileUrl = config.s3Url + addParams.Key;
                } else {
                    addParams.Key = "NO";
                    addParams.Body = "NO";
                    resObj.responseFileUrl = null;
                }

                if (result.dataValues.responseFileUrl !== null) {
                    deleteParams.Key = "ingredient-analysis-files/response-files/" + req.query.index.toString() + getExtension(result.dataValues.responseFileUrl);
                } else {
                    deleteParams.Key = "NO";
                }

                db.IngredientAnalysis.update(
                    resObj,
                    {
                        where: {
                            index: req.query.index
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                    } else {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
                                });
                            } else {
                                s3.putObject(addParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 store failed"
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                } else {
                                    if (!(addParams.Key === 'NO' && addParams.Body === 'NO')) {
                                        s3.putObject(addParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 store failed"
                                                });
                                            } else {
                                                res.json({
                                                    success: true
                                                });
                                            }
                                        });
                                    } else {
                                        res.json({
                                            success: true
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
    });
});

/*
    > 1:1 문의하기
    > POST /api/ask/questionOneToOne
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목), questionContent(요청내용)
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        if (!req.fields.title || !req.fields.questionContent) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        queObj.memberIndex = token.index;
        queObj.title = req.fields.title;
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
                } else {
                    if (!(params.Key === "NO") && !(params.Key === "NO")) {
                        s3.putObject(params, (err, data) => {
                            if (err) {
                                res.status(424).json({
                                    error: "s3 store failed"
                                });
                            } else {
                                res.json(result);
                            }
                        });
                    } else {
                        res.json(result);
                    }
                }
            });
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
    });
});

/*
    > 1:1 문의 수정
    > PUT /api/ask/editOneToOne?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일. 수정하고자 하는 요청의 index를 req.query.index로 전달
    > 필수정보: title(포스트 제목), questionContent(문의내용)
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        db.OneToOneQuestion.findOne({
            where: {
                index: req.query.index,
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                if (result.dataValues.answerContent !== null) {
                    res.status(424).json({
                        error: "already answered"
                    });
                } else {
                    if (!req.fields.title || !req.fields.questionContent) {
                        res.status(400).json({
                            error: "invalid request"
                        });
                    }

                    queObj.title = req.fields.title;
                    queObj.questionContent = req.fields.questionContent;

                    if (!(typeof req.files.questionFile === 'undefined')) {
                        if (!(req.files.questionFile.type ===  'image/gif' 
                                || req.files.questionFile.type === 'image/jpg' 
                                || req.files.questionFile.type === 'image/png'
                                || req.files.questionFile.type === 'image/jpeg')) {
                            res.status(400).json({
                                error: "invalid file(image only)"
                            });
                        } else {
                            addParams.Key = "one-to-one-question-files/question-files/" + req.query.index.toString() + getExtension(req.files.questionFile.name);
                            addParams.Body = require('fs').createReadStream(req.files.questionFile.path);
                            queObj.questionFileUrl = config.s3Url + addParams.Key;   
                        }
                    } else {
                        addParams.Key = "NO";
                        addParams.Body = "NO";
                        queObj.questionFileUrl = null;
                    }

                    if (result.dataValues.questionFileUrl !== null) {
                        deleteParams.Key = "one-to-one-question-files/question-files/" + req.query.index.toString() + getExtension(result.dataValues.questionFileUrl);
                    } else {
                        deleteParams.Key = "NO";
                    }

                    db.OneToOneQuestion.update(
                        queObj,
                        {
                            where: {
                                index: req.query.index,
                                memberIndex: token.index
                            }
                        }
                    ).then((result) => {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
                                });
                            } else {
                                s3.putObject(addParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 store failed"
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                } else {
                                    if (addParams.Key === 'NO') {
                                        res.json({
                                            success: true
                                        });
                                    } else {
                                        s3.putObject(addParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 store failed"
                                                });
                                            } else {
                                                res.json({
                                                    success: true
                                                });
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        db.OneToOneQuestion.findOne({
            where: {
                index: req.query.index,
                memberIndex: token.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                if (result.dataValues.questionFileUrl !== null) {
                    questionParams.Key = "one-to-one-question-files/question-files/" + req.query.index.toString() + getExtension(result.dataValues.questionFileUrl);
                } else {
                    questionParams.Key = "NO";
                }

                if (result.dataValues.answerFileUrl !== null) {
                    answerParams.Key = "one-to-one-question-files/answer-files/" + req.query.index.toString() + getExtension(result.dataValues.answerFileUrl);
                } else {
                    answerParams.Key = "NO";
                }

                db.OneToOneQuestion.destroy({
                    where: {
                        index: req.query.index,
                        memberIndex: token.index
                    }
                }).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                    } else {
                        if (questionParams.Key == "NO") {
                            if (answerParams.Key == "NO") {
                                res.json({
                                    success: true
                                });
                            } else {
                                s3.deleteObject(answerParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 delete failed"
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(questionParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                } else {
                                    if (answerParams.Key == "NO") {
                                        res.json({
                                            success: true
                                        });
                                    } else {
                                        s3.deleteObject(answerParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 delete failed"
                                                });
                                            } else {
                                                res.json({
                                                    success: true
                                                });
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

    decodeToken(token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        db.OneToOneQuestion.findAll({
            where: {
                memberIndex: token.index
            }
        }).then((result) => {
            res.json(result);
        });

    }).catch((error) => {
        res.status(403).json({
            error: "unauthorized request"
        });
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

    decodeToken(token).then((token) => {
        
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        if (token.index !== 1) {
            res.status(403).json({
                error: "unauthorized request"
            });
        }

        if (!req.fields.answerContent || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
        }

        ansObj.answerContent = req.fields.answerContent;

        db.OneToOneQuestion.findOne({
            where: {
                index: req.query.index
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                if (!(typeof req.files.answerFile === 'undefined')) {
                    addParams.Key = "one-to-one-question-files/answer-files/" + req.query.index.toString() + getExtension(req.files.answerFile.name);
                    addParams.Body = require('fs').createReadStream(req.files.answerFile.path);
                    ansObj.answerFileUrl = config.s3Url + addParams.Key;
                } else {
                    addParams.Key = "NO";
                    addParams.Body = "NO";
                    ansObj.answerFileUrl = null;
                }

                if (result.dataValues.answerFileUrl !== null) {
                    deleteParams.Key = "one-to-one-question-files/answer-files/" + req.query.index.toString() + getExtension(result.dataValues.answerFileUrl);
                } else {
                    deleteParams.Key = "NO";
                }

                db.OneToOneQuestion.update(
                    ansObj,
                    {
                        where: {
                            index: req.query.index
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                    } else {
                        if (deleteParams.Key === 'NO') {
                            if (addParams.Key === 'NO' && addParams.Body === 'NO') {
                                res.json({
                                    success: true
                                });
                            } else {
                                s3.putObject(addParams, (err, data) => {
                                    if (err) {
                                        res.status(424).json({
                                            error: "s3 store failed"
                                        });
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            }
                        } else {
                            s3.deleteObject(deleteParams, (err, data) => {
                                if (err) {
                                    res.status(424).json({
                                        error: "s3 delete failed"
                                    });
                                } else {
                                    if (!(addParams.Key === 'NO' && addParams.Body === 'NO')) {
                                        s3.putObject(addParams, (err, data) => {
                                            if (err) {
                                                res.status(424).json({
                                                    error: "s3 store failed"
                                                });
                                            } else {
                                                res.json({
                                                    success: true
                                                });
                                            }
                                        });
                                    } else {
                                        res.json({
                                            success: true
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
    });
});

module.exports = router;