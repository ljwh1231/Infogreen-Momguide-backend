const express = require("express");
const router = express.Router();
const Sequelize = require('sequelize');

const db = require("../../models/index");
const util = require("./util");

/*
    > 유저가 특정 댓글에 신고하는 api
    > POST /api/report/comment
    > 필수정보: req.body.commentIndex로 해당 댓글의 index를 전달, req.body.reason으로 신고 사유 체크 박스의 텍스트를 전달. 
    > 선택정보: req.body.reasonSpec으로 상세 사유 전달.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "no such comment": 존재하지 않는 댓글
          "already deleted": 이미 삭제된 댓글
          "already reported": 이미 해당 유저는 신고한 댓글
          "comment report state update failed": 댓글을 신고 상태로 바꾸는 데에 실패
          "unauthorized request": 권한 없는 접근
          "validation error": db에 넣으려는 value가 조건에 맞지 않은 value임
      }
    > {
        db에 삽입된 결과를 전달
      }
*/
router.post('/comment', (req, res) => {
    let token = req.headers['authorization'];
    const reportObj = {};

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.body.commentIndex || !req.body.reason) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        reportObj.reason = req.body.reason;

        if (req.body.reasonSpec) {
            reportObj.reasonSpec = req.body.reasonSpec;
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

                        db.Report.findOne({
                            where: {
                                member_info_index: token.index,
                                comment_index: req.body.commentIndex,
                            }
                        }).then((result) => {
                            if (result) {
                                res.status(400).json({
                                    error: "already reported"
                                });
                                return;
                            } else {
                                db.Comment.update(
                                    {
                                        isReported: true
                                    },
                                    {
                                        where: {
                                            index: req.body.commentIndex
                                        }
                                    }
                                ).catch(Sequelize.ValidationError, (err) => {
                                    if (err) {
                                        res.json({
                                            error: 'validation error'
                                        });
                                        return;
                                    }
                                }).then(async (result) => {
                                    if (!result) {
                                        res.status(424).json({
                                            error: "comment report state update failed"
                                        });
                                        return;
                                    } else {
                                        const report = await db.Report.create(
                                            reportObj
                                        ).catch(Sequelize.ValidationError, (err) => {
                                            if (err) {
                                                res.json({
                                                    error: 'validation error'
                                                });
                                                return;
                                            }
                                        });
        
                                        comment.addReport(report);
                                        member.addReport(report);

                                        res.json(report);
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