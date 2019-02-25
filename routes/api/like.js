const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');

const db = require("../../models/index");
const util = require("./util");
const config = require('../../config/config');

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
                                comment_index: req.body.commentIndex
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
                                    like: true
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
                                comment_index: req.body.commentIndex
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
                                        comment_index: req.body.commentIndex
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