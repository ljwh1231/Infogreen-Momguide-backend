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

// function to put an image into s3 bucket
async function putImage(res, file, folderName, newName) {
    const params = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    if (!(file.type ===  'image/gif' 
            || file.type === 'image/jpg' 
            || file.type === 'image/png'
            || file.type === 'image/jpeg')) {
        res.status(400).json({
            error: "invalid file(only image)"
        });
        return;
    } else {
        params.Key = folderName + newName + getExtension(file.name);
        params.Body = require('fs').createReadStream(file.path);
    }

    await s3.putObject(params, (err, data) => {
        if (err){
            res.status(424).json({
                error: "s3 store failed"
            });
            return;
        }
    })

    return params.Key;
}

// function to delete an image in s3 bucket
async function deleteImage(res, folderName, fileName, fileUrl) {
    const params = {
        Bucket: config.s3Bucket,
        Key: null,
    };

    params.Key = folderName + fileName + getExtension(fileUrl);

    await s3.deleteObject(params, (err, data) => {
        if (err){
            res.status(424).json({
                error: "s3 delete failed"
            });
            return;
        }
    });

    return params.Key;
}


/*
    > admin이 꿀팁을 작성하는 api
    > POST /api/tip/post
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), titleImage(표지 이미지), contentImage(내용 이미지)
      content는 없을 경우 빈 string "" 보낼 것
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "invalied file(image only)": 이미지가 아닌 파일이 넘어옴
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "post add failed": 작성 실패
      }
    > result: {
        db안에 생성된 포스트 정보 전달
    }
*/
router.post('/post', formidable(), (req, res) => {
    let token = req.headers['authorization'];

    postObj = {};

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

        if (!req.fields.title || !req.fields.subtitle || !req.fields.content || !req.files.titleImage || typeof req.files.titleImage === 'undefined' 
                || !req.files.contentImage || typeof req.files.contentImage === 'undefined') {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;

        db.HoneyTip.findAll({
            limit: 1,
            where: {},
            order: [[ 'index', 'DESC' ]]
        }).then((result) => {
            let nextIndex = 0;
            if (result.length === 0) {
                nextIndex = 1;
            } else {
                nextIndex = result[0].dataValues.index + 1;
            }

            putImage(res, req.files.titleImage, 'tip-images/title-images/', nextIndex.toString()).then(key => {
                postObj.titleImageUrl = config.s3Url + key;

                putImage(res, req.files.contentImage, 'tip-images/content-images/', nextIndex.toString()).then(key => {
                    postObj.contentImageUrl = config.s3Url + key;
                    
                    db.HoneyTip.create(
                        postObj
                    ).then((result) => {
                        if (!result) {
                            res.status(424).json({
                                error: "post add failed"
                            });
                        } else {
                            res.json(result);
                            return;
                        }
                    });
                });
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
    > admin이 꿀팁을 수정하는 api
    > PUT /api/tip/post?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), titleImage(표지 사진), contentImage(내용 사진) 
      content는 없을 경우 빈 string "" 보낼 것, 해당하는 포스트의 index를 req.query.index로 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "invalied file(image only)": 이미지가 아닌 파일이 넘어옴
          "no such post": 해당 포스트는 존재하지 않음
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실해
          "s3 store failed": s3 버켓에 이미지 저장 실패
          "post update failed": 수정 실패
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.put('/post', formidable(), (req, res) => {
    let token = req.headers['authorization'];  

    postObj = {};

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

        if (!req.fields.title || !req.fields.subtitle || !req.fields.content || !req.files.titleImage || typeof req.files.titleImage === 'undefined' 
        || !req.files.contentImage || typeof req.files.contentImage === 'undefined' || !req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        postObj.title = req.fields.title;
        postObj.subtitle = req.fields.subtitle;
        postObj.content = req.fields.content;

        db.HoneyTip.findOne({
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
                deleteImage(res, 'tip-images/title-images/', result.dataValues.index.toString(), result.dataValues.titleImageUrl).then(key => {
                    deleteImage(res, 'tip-images/content-images/', result.dataValues.index.toString(), result.dataValues.contentImageUrl).then(key => {
                        putImage(res, req.files.titleImage, 'tip-images/title-images/', result.dataValues.index.toString()).then(key => {
                            postObj.titleImageUrl = config.s3Url + key;

                            putImage(res, req.files.contentImage, 'tip-images/content-images/', result.dataValues.index.toString()).then(key => {
                                postObj.contentImageUrl = config.s3Url + key;

                                db.HoneyTip.update(
                                    postObj,
                                    {
                                        where: {
                                            index: result.dataValues.index
                                        }
                                    }
                                ).then((result) => {
                                    if (!result) {
                                        res.status(424).json({
                                            error: "post update failed"
                                        });
                                        return;
                                    } else {
                                        res.json({
                                            success: true
                                        });
                                    }
                                });
                            });
                        });
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
    > admin이 꿀팁을 삭제하는 api
    > DELETE /api/tip/post?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.index로 삭제하고자 하는 포스트의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "unauthorized request": 사용 권한이 없는 접근
          "no such post": 해당 포스트는 존재하지 않음
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "post delete failed": 포스트 삭제 실패
      }
    > success: {
        true: 성공적으로 변경
      }
*/
router.delete('/post', (req, res) => {
    let token = req.headers['authorization'];

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

        db.HoneyTip.findOne({
            where: Number(req.query.index)
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                deleteImage(res, 'tip-images/title-images/', result.dataValues.index.toString(), result.dataValues.titleImageUrl).then(key => {
                    deleteImage(res, 'tip-images/content-images/', result.dataValues.index.toString(), result.dataValues.contentImageUrl).then(key => {
                        db.HoneyTip.destroy({
                            where: {
                                index: result.dataValues.index
                            }
                        }).then((result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "post delete failed"
                                });
                            } else {
                                res.json({
                                    success: true
                                });
                            }
                        });
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
    > 꿀팁 불러오는 api
    > GET /api/tip/post?page=1
    > req.query.page로 해당 페이지 넘버를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "find error": 탐색 오류
      }
    > {
        Data: [] (제품 정보 배열)
        totalPages: 전체 페이지 수
        nextNum: 다음 페이지에서 보여야할 포스트 수
      }
*/
router.get('/post', (req, res) => {
    let limit = 12;

    if (!req.query.page) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.HoneyTip.findAndCountAll({
        where: {}
    }).then((result) => {
        if (!result) {
            res.status(424).json({
                error: "find error"
            });
            return;
        }

        let totalNum = result.count;
        let totalPages = Math.ceil(totalNum/limit);
        let nextNum = 0;

        db.HoneyTip.findAll({
            where: {},
            limit: limit,
            offset: limit * (Number(req.query.page)-1),
            attributes: ['title', 'subtitle', 'titleImageUrl', 'created_at']
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "find error"
                });
                return;
            } else {
                if (Number(req.query.page) === (totalPages - 1)) {
                    nextNum = totalNum % limit;
                } else if (Number(req.query.page) === totalPages) {
                    nextNum = 0;
                } else {
                    nextNum = limit;
                }
                res.json({Data: result, totalPages: totalPages, nextNum: nextNum});
                return;
            }
        });
    });
});

/*
    > 유저가 꿀팁에 댓글을 작성하는 api
    > POST /api/tip/comment
    > req.body.content로 댓글 내용, req.body.tipIndex로 해당 꿀팁의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 존재하지 않는 포스트
          "no such member": 존재하지 않는 회원
          "unauthorized request": 권한 없는 접근
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/comment', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.content) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.HoneyTip.findOne({
            where: {
                index: req.body.tipIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                const tip = result;

                db.MemberInfo.findOne({
                    index: token.index
                }).then(async (result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such member"
                        });
                        return;
                    } else {
                        const member = result;
                        
                        const comment = await db.Comment.create({
                            content: req.body.content,
                        });

                        tip.addComment(comment);
                        member.addComment(comment);

                        res.json(comment);
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
    > 유저가 꿀팁에 작성한 댓글을 삭제하는 api
    > DELETE /api/tip/comment
    > req.body.index로 댓글의 index, req.body.tipIndex로 해당 꿀팁의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "comment delete failed": 댓글 삭제 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 댓글을 삭제
      }
*/
router.delete('/comment', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Comment.findOne({
            where: {
                index: req.body.index,
                member_info_index: token.index,
                honey_tip_index: req.body.tipIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such comment"
                });
                return;
            } else {
                if (result.dataValues.isDeleted) {
                    res.status(400).json({
                        error: "already deleted"
                    });
                }

                db.Comment.update(
                    {
                        content: "삭제된 댓글입니다.",
                        isDeleted: true
                    },
                    {
                        where: {
                            index: req.body.index,
                            member_info_index: token.index,
                            honey_tip_index: req.body.tipIndex
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "comment delete failed"
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
    > 유저가 팁 댓글에 대댓글을 작성하는 api
    > POST /api/tip/childComment
    > req.body.content로 댓글 내용, req.body.commentIndex로 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "no such post": 존재하지 않는 포스트
          "no such member": 존재하지 않는 회원
          "unauthorized request": 권한 없는 접근
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/childComment', (req, res) => {
    let token = req.headers['authorization'];

    decodeToken(res, token).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.content) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Comment.findOne({
            where: {
                index: req.body.commentIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such comment"
                });
                return;
            } else  {
                result.increment("childNum");
                const parentIndex = result.dataValues.index;

                db.HoneyTip.findOne({
                    where: {
                        index: result.dataValues.honey_tip_index
                    }
                }).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                        return;
                    } else {
                        const tip = result;

                        db.MemberInfo.findOne({
                            where: {
                                index: token.index
                            }
                        }).then(async (result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "no such member"
                                });
                                return;
                            } else {
                                const member = result;

                                const childComment = await db.Comment.create({
                                    content: req.body.content,
                                    parentIndex: parentIndex
                                });
                            
                                tip.addComment(childComment);
                                member.addComment(childComment);
                            
                                res.json(childComment);
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

module.exports = router;