const express = require("express");
const router = express.Router();
const Sequelize = require('sequelize');

const db = require("../../models/index");
const util = require("./util");

/*
    > 유저가 특정 댓글에 좋아요하는 api
    > POST /api/like/commentLike
    > req.body.commentIndex로 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "already liked": 이미 좋아요한 댓글
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/commentLike', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.commentIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then((member) => {
            if (!member){
                res.status(424).json({
                    error: "no such member"
                });
            } else {
                db.Comment.findOne({
                    where: {
                        index: req.body.commentIndex
                    }
                }).then((comment) => {
                    if (!comment) {
                        res.status(424).json({
                            error: "no such comment"
                        });
                        return;
                    } else {
                        if (comment.dataValues.isDeleted) {
                            res.status(400).json({
                                error: "already deleted comment"
                            });
                            return;
                        }

                        db.LikeOrHate.findOne({
                            where: {
                                member_info_index: token.index,
                                comment_index: req.body.commentIndex,
                                assessment: true
                            }
                        }).then(async (result) => {
                            if (result) {
                                res.status(400).json({
                                    error: "already liked"
                                });
                                return;
                            } else {
                                comment.increment("likeNum");

                                const like = await db.LikeOrHate.create({
                                    assessment: true
                                }).catch(Sequelize.ValidationError, (err) => {
                                    if (err) {
                                        res.json({
                                            error: 'validation error'
                                        });
                                        return;
                                    }
                                });

                                comment.addLikeOrHate(like);
                                member.addLikeOrHate(like);

                                res.json(like);
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
    > 유저가 특정 댓글에 한 좋아요를 취소하는 api
    > DELETE /api/like/commentLike
    > req.body.commentIndex로 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "not liked": 좋아요하지 않은 댓글
          "like delete failed": 좋아요 취소 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 취소 완료
      }
*/
router.delete('/commentLike', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.commentIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then((member) => {
            if (!member){
                res.status(424).json({
                    error: "no such member"
                });
            } else {
                db.Comment.findOne({
                    where: {
                        index: req.body.commentIndex
                    }
                }).then((comment) => {
                    if (!comment) {
                        res.status(424).json({
                            error: "no such comment"
                        });
                        return;
                    } else {
                        if (comment.dataValues.isDeleted) {
                            res.status(400).json({
                                error: "already deleted comment"
                            });
                            return;
                        }

                        db.LikeOrHate.findOne({
                            where: {
                                member_info_index: token.index,
                                comment_index: req.body.commentIndex,
                                assessment: true
                            }
                        }).then(async (result) => {
                            if (!result) {
                                res.status(400).json({
                                    error: "not liked"
                                });
                                return;
                            } else {
                                comment.decrement("likeNum");

                                db.LikeOrHate.destroy({
                                    where: {
                                        member_info_index: token.index,
                                        comment_index: req.body.commentIndex,
                                        assessment: true
                                    }
                                }).then((result) => {
                                    if (!result) {
                                        res.status(424).json({
                                            error: "like cancel failed"
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
    > 유저가 특정 댓글에 싫어요하는 api
    > POST /api/like/commenthate
    > req.body.commentIndex로 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "already hated": 이미 싫어요한 댓글
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/commentHate', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.commentIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then((member) => {
            if (!member){
                res.status(424).json({
                    error: "no such member"
                });
            } else {
                db.Comment.findOne({
                    where: {
                        index: req.body.commentIndex
                    }
                }).then((comment) => {
                    if (!comment) {
                        res.status(424).json({
                            error: "no such comment"
                        });
                        return;
                    } else {
                        if (comment.dataValues.isDeleted) {
                            res.status(400).json({
                                error: "already deleted comment"
                            });
                            return;
                        }

                        db.LikeOrHate.findOne({
                            where: {
                                member_info_index: token.index,
                                comment_index: req.body.commentIndex,
                                assessment: false
                            }
                        }).then(async (result) => {
                            if (result) {
                                res.status(400).json({
                                    error: "already hated"
                                });
                                return;
                            } else {
                                comment.increment("hateNum");

                                const hate = await db.LikeOrHate.create({
                                    assessment: false
                                }).catch(Sequelize.ValidationError, (err) => {
                                    if (err) {
                                        res.json({
                                            error: 'validation error'
                                        });
                                        return;
                                    }
                                });

                                comment.addLikeOrHate(hate);
                                member.addLikeOrHate(hate);

                                res.json(hate);
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
    > 유저가 특정 댓글에 한 싫어요를 취소하는 api
    > DELETE /api/like/commentHate
    > req.body.commentIndex로 해당 댓글의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "not hated": 싫어요하지 않은 댓글
          "hate delete failed": 좋아요 취소 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 취소 완료
      }
*/
router.delete('/commentHate', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.commentIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then((member) => {
            if (!member){
                res.status(424).json({
                    error: "no such member"
                });
            } else {
                db.Comment.findOne({
                    where: {
                        index: req.body.commentIndex
                    }
                }).then((comment) => {
                    if (!comment) {
                        res.status(424).json({
                            error: "no such comment"
                        });
                        return;
                    } else {
                        if (comment.dataValues.isDeleted) {
                            res.status(400).json({
                                error: "already deleted comment"
                            });
                            return;
                        }

                        db.LikeOrHate.findOne({
                            where: {
                                member_info_index: token.index,
                                comment_index: req.body.commentIndex,
                                assessment: false
                            }
                        }).then(async (result) => {
                            if (!result) {
                                res.status(400).json({
                                    error: "not hated"
                                });
                                return;
                            } else {
                                comment.decrement("hateNum");

                                db.LikeOrHate.destroy({
                                    where: {
                                        member_info_index: token.index,
                                        comment_index: req.body.commentIndex,
                                        assessment: false
                                    }
                                }).then((result) => {
                                    if (!result) {
                                        res.status(424).json({
                                            error: "hate cancel failed"
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
    > 유저가 특정 이벤트에 좋아요하는 api
    > POST /api/like/eventLike
    > req.body.eventIndex로 해당 이벤트의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "no such event": 존재하지 않는 이벤트
          "already liked": 이미 좋아요한 이벤트
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/eventLike', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.eventIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then((member) => {
            if (!member){
                res.status(424).json({
                    error: "no such member"
                });
            } else {
                db.Event.findOne({
                    where: {
                        index: req.body.eventIndex
                    }
                }).then((event) => {
                    if (!event) {
                        res.status(424).json({
                            error: "no such event"
                        });
                        return;
                    } else {

                        db.LikeOrHate.findOne({
                            where: {
                                member_info_index: token.index,
                                event_index: req.body.eventIndex,
                                assessment: true
                            }
                        }).then(async (result) => {
                            if (result) {
                                res.status(400).json({
                                    error: "already liked"
                                });
                                return;
                            } else {
                                const like = await db.LikeOrHate.create({
                                    assessment: true
                                }).catch(Sequelize.ValidationError, (err) => {
                                    if (err) {
                                        res.json({
                                            error: 'validation error'
                                        });
                                        return;
                                    }
                                });

                                event.addLikeOrHate(like);
                                member.addLikeOrHate(like);

                                res.json(like);
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
    > 유저가 특정 이벤트에 한 좋아요를 취소하는 api
    > DELETE /api/like/eventLike
    > req.body.eventIndex로 해당 이벤트의 index를 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "no such event": 존재하지 않는 이벤트
          "not liked": 좋아요하지 않은 댓글
          "like delete failed": 좋아요 취소 실패
          "unauthorized request": 권한 없는 접근
      }
    > success: {
        true: 성공적으로 취소 완료
      }
*/
router.delete('/eventLike', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.eventIndex) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then((member) => {
            if (!member){
                res.status(424).json({
                    error: "no such member"
                });
            } else {
                db.Event.findOne({
                    where: {
                        index: req.body.eventIndex
                    }
                }).then((event) => {
                    if (!event) {
                        res.status(424).json({
                            error: "no such event"
                        });
                        return;
                    } else {
                        db.LikeOrHate.findOne({
                            where: {
                                member_info_index: token.index,
                                event_index: req.body.eventIndex,
                                assessment: true
                            }
                        }).then(async (result) => {
                            if (!result) {
                                res.status(400).json({
                                    error: "not liked"
                                });
                                return;
                            } else {
                                db.LikeOrHate.destroy({
                                    where: {
                                        member_info_index: token.index,
                                        event_index: req.body.eventIndex,
                                        assessment: true
                                    }
                                }).then((result) => {
                                    if (!result) {
                                        res.status(424).json({
                                            error: "like cancel failed"
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