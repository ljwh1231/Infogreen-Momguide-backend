const express = require("express");
const router = express.Router();
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const formidable = require('express-formidable');

const db = require("../../models/index");
const config = require('../../config/config');
const util = require('./util');

async function putImage(res, file, folderName, fileName) {
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
        params.Key = folderName + fileName + util.getExtension(file.name);
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

    params.Key = folderName + fileName + util.getExtension(fileUrl);

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
    > admin이 당첨자발표를 작성하는 api
    > POST /api/winner/post
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), titleImage(표지 이미지), contentImage(내용 이미지)
      content는 없을 경우 빈 string "" 보낼 것.
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

    util.decodeToken(token, res).then((token) => {
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
        
        db.Event.findAll({
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

            putImage(res, req.files.titleImage, 'winner-images/title-images/', nextIndex).then(key => {
                postObj.titleImageUrl = config.s3Url + key;

                putImage(res, req.files.contentImage, 'winner-images/content-images/', nextIndex).then(key => {
                    postObj.contentImageUrl = config.s3Url + key;
                    
                    db.Winner.create(
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
    > admin이 당첨자발표를 수정하는 api
    > PUT /api/winner/post?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: title(포스트 제목),subtitle(포스트 부제목), content(포스트 내용), titleImage(표지 사진), contentImage(내용 사진) 
      content는 없을 경우 빈 string "" 보낼 것
      해당하는 포스트의 index를 req.query.index로 전달
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

    util.decodeToken(token, res).then((token) => {
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
        
        db.Winner.findOne({
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
                deleteImage(res, 'winner-images/title-images/', result.dataValues.index.toString(), result.dataValues.titleImageUrl).then(key => {
                    deleteImage(res, 'winner-images/content-images/', result.dataValues.index.toString(), result.dataValues.contentImageUrl).then(key => {
                        putImage(res, req.files.titleImage, 'winner-images/title-images/', result.dataValues.index.toString()).then(key => {
                            postObj.titleImageUrl = config.s3Url + key;

                            putImage(res, req.files.contentImage, 'winner-images/content-images/', result.dataValues.index.toString()).then(key => {
                                postObj.contentImageUrl = config.s3Url + key;

                                db.Winner.update(
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
    > admin이 당첨자발표를 삭제하는 api
    > DELETE /api/winner/post?index=1
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
    
    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.query.index) {
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

        db.Winner.findOne({
            where: Number(req.query.index)
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
            } else {
                deleteImage(res, 'winner-images/title-images/', result.dataValues.index.toString(), result.dataValues.titleImageUrl).then(key => {
                    deleteImage(res, 'winner-images/content-images/', result.dataValues.index.toString(), result.dataValues.contentImageUrl).then(key => {
                        db.Winner.destroy({
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
    > 당첨자발표 목록 불러오는 api
    > GET /api/winner/postList?order=latest&page=1
    > req.query.page로 해당 페이지 넘버를 전달, req.query.order로 정렬 방식을 전달(latest가 최신순, recommend는 추천순)
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
router.get('/postList', (req, res) => {
    let limit = 12;

    if (!req.query.page || !req.query.order) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    if ((req.query.order !== 'latest') && (req.query.order !== 'recommend')) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.Winner.findAndCountAll({
        where: showCondition
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

        if (req.query.order === 'latest') {
            db.Winner.findAll({
                where: {},
                limit: limit,
                offset: limit * (Number(req.query.page)-1),
                attributes: ['index', 'title', 'subtitle', 'titleImageUrl', 'created_at'],
                order: [['created_at', 'DESC']]
            }).then(async (result) => {
                if (!result) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    if (Number(req.query.page) === (totalPages - 1)) {
                        nextNum = totalNum % limit;
                    } else if (Number(req.query.page) >= totalPages) {
                        nextNum = 0;
                    } else if (result.length === 0) {
                        nextNum = 0;
                    } else {
                        nextNum = limit;
                    }
                    res.json({Data: result, totalPages: totalPages, nextNum: nextNum});
                    return;
                }
            });
        } else if (req.query.order === 'recommend') {
            db.Winner.findAll({
                where: {},
                attributes: ['index', 'title', 'subtitle', 'titleImageUrl', 'created_at']
            }).then(async (winners) => {
                if (!winners) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    for (let i=0; i<winners.length; ++i) {
                        const likeList = await winners[i].getLikeOrHates();
                        winners[i].dataValues.likeCount = likeList.length;
                    }
                    winners.sort((winner1, winner2) => {
                        return winner1.dataValues.likeCount > winner2.dataValues.likeCount ? -1
                            : (winner1.dataValues.likeCount < winner2.dataValues.likeCount ? 1 : 0)
                    });

                    if (Number(req.query.page) === totalPages) {
                        winnersSliced = winners.slice(((Number(req.query.page))-1) * limit, winners.length);
                    } else {
                        winnersSliced = winners.slice(((Number(req.query.page))-1) * limit, Number(req.query.page) * limit);
                    }

                    if (Number(req.query.page) === (totalPages - 1)) {
                        nextNum = totalNum % limit;
                    } else if (Number(req.query.page) >= totalPages) {
                        nextNum = 0;
                    } else {
                        nextNum = limit;
                    }
                    res.json({Data: winnersSliced, totalPages: totalPages, nextNum: nextNum});
                    return;
                }
            });
        }
    });
});

/*
    > 유저가 당첨자발표에 댓글을 작성하는 api
    > POST /api/winner/comment
    > req.body.content로 댓글 내용, req.body.winnerIndex로 해당 당첨자발표의 index 전달
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

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.content || !req.body.winnerIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Winner.findOne({
            where: {
                index: req.body.winnerIndex
            }
        }).then((result) => {
            if (!result) {
                res.status(424).json({
                    error: "no such post"
                });
                return;
            } else {
                const winner = result;

                db.MemberInfo.findOne({
                    index: token.index
                }).then(async (result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such member"
                        });
                    } else {
                        const member = result;
                        
                        const comment = await db.Comment.create({
                            content: req.body.content,
                        });

                        winner.addComment(comment);
                        member.addComment(comment);

                        res.json(comment);
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
    > 유저가 당첨자발표에 작성한 댓글을 삭제하는 api(대댓글도 똑같으므로 같은 api로 사용한다.)
    > DELETE /api/winner/comment
    > req.body.index로 댓글의 index, req.body.winnerIndex로 해당 이벤트의 index 전달
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

    util.decodeToken(token, res).then((token) => {
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
                winner_index: req.body.winnerIndex
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
                    return;
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
                            winner_index: req.body.winnerIndex
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
    > 유저가 당첨자발표에 작성한 댓글을 수정하는 api(대댓글도 똑같으므로 같은 api로 사용한다.)
    > PUT /api/winner/comment
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.body.content로 수정 내용, req.body.index로 댓글의 index, 
      req.body.winnerIndex로 해당 당첨자발표의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "comment edit failed": 댓글 수정 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 댓글을 수정
      }
*/
router.put('/comment', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.content || !req.body.index || !req.body.winnerIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Comment.findOne({
            where: {
                index: req.body.index,
                member_info_index: token.index,
                winner_index: req.body.winnerIndex
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
                    return;
                }

                db.Comment.update(
                    {
                        content: req.body.content,
                    },
                    {
                        where: {
                            index: req.body.index,
                            member_info_index: token.index,
                            winner_index: req.body.winnerIndex
                        }
                    }
                ).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "comment edit failed"
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
    > 유저가 당첨자발표 댓글에 대댓글을 작성하는 api
    > POST /api/winner/childComment
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

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.content || !req.body.commentIndex) {
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

                db.Winner.findOne({
                    where: {
                        index: result.dataValues.winner_index
                    }
                }).then((result) => {
                    if (!result) {
                        res.status(424).json({
                            error: "no such post"
                        });
                        return;
                    } else {
                        const winner = result;

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
                            
                                winner.addComment(childComment);
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

/*
    > 당첨자발표 포스트 하나의 본문과 그 딸린 댓글들을 불러오는 api
    > GET /api/winner/post?index=1&order=latest&page=1
    > req.query.index 해당 당첨자발표의 index를 전달, req.query.page에 해당 페이지 넘버를 전달
      req.query.order로 정렬 순서 전달.(latest: 최신순, recommend: 추천순)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such post": 존재하지 않는 포스트
          "find error": db에 있는 정보를 가져오는 데에 문제 발생
          "unauthorized request": 권한 없는 접근
      }
    > {
        winner: 당첨자 발표 본문,
        comments: 댓글 정보를 배열로 전달. 각 댓글 객체 안의 creator 객체로 작성자의 정보를 전달.(이미 삭제된 댓글의 경우 작성자 정보가 빈 객체로 전달.)
            like, hate는 로그인한 유저가 해당 댓글에 좋아요/싫어요를 했는지의 여부를 전달. 만약 둘 다 하지 않았거나 로그인하지 않은 상태라면 둘 다 false를 전달.
        totalPages: 전체 페이지
      }
*/
router.get('/post', (req, res) => {
    const limit = 10;
    
    if (!req.query.index || !req.query.page || !req.query.order) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    if (req.query.order !== 'latest' && req.query.order !== 'recommend') {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.Winner.findOne({
        where: {
            index: req.query.index
        }
    }).then((winner) => {
        if (!winner) {
            res.status(424).json({
                error: "no such post"
            });
            return;
        } else {
            winner.getComments().then(async (comments) => {
                if (!comments) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    const totalNum = comments.length;
                    const totalPages = Math.ceil(comments.length/limit);
                    let sortedComments;

                    if (req.query.order === 'latest') {
                        sortedComments = await winner.getComments({
                            limit: limit,
                            offset: limit * (Number(req.query.page)-1),
                            order: [['created_at', 'DESC']]
                        });
                    } else if (req.query.order === 'recommend') {
                        sortedComments = await winner.getComments({
                            limit: limit,
                            offset: limit * (Number(req.query.page)-1),
                            order: [['likeNum', 'DESC']]
                        });
                    }

                    for (let i=0; i<sortedComments.length; ++i) {
                        let like = false;
                        let hate = false;

                        if (req.headers['authorization']) {
                            const token = await util.decodeToken(req.headers['authorization'], res).catch((error) => {
                                res.status(403).json({
                                    error: "unauthorized request"
                                });
                                return;
                            });

                            if (!token.index || !token.email || !token.nickName) {
                                res.status(400).json({
                                    error: "invalid request"
                                });
                                return;
                            }

                            const likeOrHate = await db.LikeOrHate.findAll({
                                where: {
                                    member_info_index: token.index,
                                    comment_index: sortedComments[i].dataValues.index
                                }
                            });

                            if (likeOrHate.length === 1) {
                                if (likeOrHate[0].dataValues.assessment) {
                                    like = true;
                                } else {
                                    hate = true;
                                }
                            } else if (likeOrHate.length === 2) {
                                like = true;
                                hate = true;
                            }
                        }

                        if (sortedComments[i].dataValues.isDeleted) {
                            sortedComments[i].dataValues.creator = {};
                        } else {
                            await db.MemberInfo.findOne({
                                attributes: [
                                    'index', 'nickName', 'photoUrl', 'gender', 'memberBirthYear', 'memberBirthMonth', 'memberBirthDay',
                                    'hasChild', 'childBirthYear', 'childBirthMonth', 'childBirthDay'
                                ],
                                where: {
                                    index: sortedComments[i].dataValues.member_info_index
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "find error"
                                    });
                                    return;
                                } else {
                                    sortedComments[i].dataValues.creator = result.dataValues;
                                    sortedComments[i].dataValues.like = like;
                                    sortedComments[i].dataValues.hate = hate;
                                }
                            });
                        }
                    }
                    res.json({winner: winner, comments: sortedComments, totalPages: totalPages, totalNum: totalNum});
                    return;
                }
            });
        }
    });
});

/*
    > 당첨자발표 포스트의 특정 댓글의 대댓글들을 불러오는 api
    > GET /api/winner/childComment?index=1&page=1
    > req.query.index 해당 댓글의 index를 전달, req.query.page에 해당 페이지 넘버를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such comment": 존재하지 않는 댓글
          "not proper comment": 적절하지 않은 댓글(이벤트가 아닌 꿀팁의 댓글이거나 대댓글을 불러올 경우)
          "find error": db에 있는 정보를 가져오는 데에 문제 발생
          "unauthorized request": 권한 없는 접근
      }
    > {
        childComments: 대댓글 정보를 배열로 전달. 각 댓글 객체 안의 creator 객체로 작성자의 정보를 전달.(이미 삭제된 댓글의 경우 작성자 정보가 빈 객체로 전달.)
            like, hate는 로그인한 유저가 해당 댓글에 좋아요/싫어요를 했는지의 여부를 전달. 만약 둘 다 하지 않았거나 로그인하지 않은 상태라면 둘 다 false를 전달.
        totalPages: 전체 페이지
      }
*/
router.get('/childComment', (req, res) => {
    const limit = 10;

    if (!req.query.index || !req.query.page) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    db.Comment.findOne({
        where: {
            index: Number(req.query.index)
        }
    }).then((comment) => {
        if (!comment) {
            res.status(424).json({
                error: "no such comment"
            });
            return;
        } else if (comment.dataValues.honey_tip_index !== null || comment.dataValues.event_index !== null || comment.dataValues.parentIndex !== null) {
            res.status(424).json({
                error: "not proper comment"
            });
            return;
        } else {
            db.Comment.findAll({
                where: {
                    parentIndex: comment.dataValues.index
                }
            }).then(async (childComments) => {
                if (!childComments) {
                    res.status(424).json({
                        error: "find error"
                    });
                    return;
                } else {
                    const totalPages = Math.ceil(childComments.length/limit);
                    const pagedChildComments = await db.Comment.findAll({
                        where: {
                            parentIndex: comment.dataValues.index
                        },
                        limit: limit,
                        offset: limit * (Number(req.query.page)-1)
                    });

                    for (let i=0; i<pagedChildComments.length; ++i) {
                        let like = false;
                        let hate = false;

                        if (req.headers['authorization']) {
                            const token = await util.decodeToken(req.headers['authorization'], res).catch((error) => {
                                res.status(403).json({
                                    error: "unauthorized request"
                                });
                                return;
                            });

                            if (!token.index || !token.email || !token.nickName) {
                                res.status(400).json({
                                    error: "invalid request"
                                });
                                return;
                            }

                            const likeOrHate = await db.LikeOrHate.findAll({
                                where: {
                                    member_info_index: token.index,
                                    comment_index: pagedChildComments[i].dataValues.index
                                }
                            });

                            if (likeOrHate.length === 1) {
                                if (likeOrHate[0].dataValues.assessment) {
                                    like = true;
                                } else {
                                    hate = true;
                                }
                            } else if (likeOrHate.length === 2) {
                                like = true;
                                hate = true;
                            }
                        }

                        if (pagedChildComments[i].dataValues.isDeleted){
                            pagedChildComments[i].dataValues.creator = {};
                        } else {
                            await db.MemberInfo.findOne({
                                attributes: [
                                    'index', 'nickName', 'photoUrl', 'gender', 'memberBirthYear', 'memberBirthMonth', 'memberBirthDay',
                                    'hasChild', 'childBirthYear', 'childBirthMonth', 'childBirthDay'
                                ],
                                where: {
                                    index: pagedChildComments[i].dataValues.member_info_index
                                }
                            }).then((result) => {
                                if (!result) {
                                    res.status(424).json({
                                        error: "find error"
                                    });
                                    return;
                                } else {
                                    pagedChildComments[i].dataValues.creator = result.dataValues;
                                    pagedChildComments[i].dataValues.like = like;
                                    pagedChildComments[i].dataValues.hate = hate;
                                }
                            });
                        }
                    }
                    res.json({childComments: pagedChildComments, totalPages: totalPages});
                    return;
                }
            });
        }
    });
});

/*
    > 유저가 해당 당첨자발표 포스트를 열었을 때 좋아요를 했는지 안했는지 체크하는 api
    > GET /api/winner/post/like?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.index로 확인하고자 하는 당첨자발표의 index 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such winner": 존재하지 않는 당첨자 발표
          "unauthorized request": 권한 없는 접근
      }
    > like: {
        true: 유저가 이 이벤트에 좋아요를 했음
        false: 유저가 이 이벤트에 좋아요를 하지 않았음
      }
*/
router.get('/post/like', (req, res) => {
    if (!req.headers['authorization']) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.query.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.Winner.findOne({
            where: {
                index: Number(req.query.index)
            }
        }).then((winner) => {
            if (!winner) {
                res.status(424).json({
                    error: "no such winner"
                });
                return;
            } else {
                db.LikeOrHate.findOne({
                    where: {
                        member_info_index: token.index,
                        winner_index: Number(req.query.index),
                        assessment: true
                    }
                }).then((result) => {
                    if (!result) {
                        res.json({
                            like: false
                        });
                        return;
                    } else {
                        res.json({
                            like: true
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

module.exports = router;