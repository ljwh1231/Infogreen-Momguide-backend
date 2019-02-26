const express = require("express");
const router = express.Router();
const jwt = require('jsonwebtoken');
const formidable = require('express-formidable');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const db = require("../../models/index");
const util = require("./util");
const config = require('../../config/config');

/*
    > admin이 전체 알림을 추가
    > POST /api/alarm/publicAlarm
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일.
    > 필수정보: content(알림 내용), image(알림 이미지), linkUrl(알림 누르면 이동할 url)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "alarm add failed": 알림이 저장되지 않음
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > [
        db안에 저장된 결과가 반환
      ]
*/
router.post('/publicAlarm', formidable(), (req, res) => {
    let token = req.headers['authorization'];
    const addObj = {};

    const params = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.files.image || !req.fields.content || !req.fields.linkUrl) {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (token.index !== 1) {
            req.status(403).json({
                error: "unauthorized request"
            });
            return;
        }

        addObj.content = req.fields.content;
        addObj.linkUrl = req.fields.linkUrl;
    
        if (typeof req.files.image === 'undefined') {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }    

        if (!(req.files.image.type ===  'image/gif' 
                || req.files.image.type === 'image/jpg' 
                || req.files.image.type === 'image/png'
                || req.files.image.type === 'image/jpeg')) {
            res.status(400).json({
                error: "invalid file(image only)"
            });
            return;        
        }

        let nextIndex = 0;

        db.PublicAlarm.findAll({
            where: {},
            limit: 1,
            order: [[ 'index', 'DESC' ]]
        }).then((result) => {
            if (result.length === 0) {
                nextIndex = 1;
            } else {
                nextIndex = result[0].dataValues.index + 1;
            }

            params.Key = "public-alarm-images/" + nextIndex.toString() + util.getExtension(req.files.image.name);
            params.Body = require('fs').createReadStream(req.files.image.path);

            addObj.imageUrl = config.s3Url + params.Key;

            s3.putObject(params, (err, data) => {
                if (err) {
                    res.status(424).json({
                        error: "s3 store failed"
                    });
                    return;
                } else {
                    db.PublicAlarm.create(addObj).then((alarm) => {
                        if (!alarm) {
                            res.status(424).json({
                                error: "alarm add failed"
                            });
                            return;
                        } else {
                            db.MemberInfo.findAll({
                                where: {}
                            }).then(async (members) => {
                                for (let i=0; i<members.length; ++i) {
                                    await members[i].addPublicAlarms(alarm);
                                }

                                res.json(alarm);
                                return;
                            });
                        }
                    });
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
    > admin이 전체 알림을 수정
    > PUT /api/alarm/publicAlarm?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. form data로 데이터 전달. 각 데이터의 이름은 디비와 통일. 
      req.query.index로 수정하고자 하는 알람의 index 전달
    > 필수정보: content(알림 내용), image(알림 이미지), linkUrl(알림 누르면 이동할 url)
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "no such alarm": 존재하지 않는 알람
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "s3 store failed": s3 버켓 안에 이미지 저장 실패
          "alarm update failed": 알림이 수정되지 않음
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success : {
        true: 성공적으로 수정 완료
      } 
*/
router.put('/publicAlarm', formidable(), (req, res) => {
    let token = req.headers['authorization'];
    const addObj = {};

    const addParams = {
        Bucket: config.s3Bucket,
        Key: null,
        ACL: 'public-read',
        Body: null
    };

    const deleteParams = {
        Bucket: config.s3Bucket,
        Key: null
    };

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (!req.files.image || !req.fields.content || !req.fields.linkUrl) {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (token.index !== 1) {
            req.status(403).json({
                error: "unauthorized request"
            });
            return;
        }

        addObj.content = req.fields.content;
        addObj.linkUrl = req.fields.linkUrl;
    
        if (typeof req.files.image === 'undefined') {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }    

        if (!(req.files.image.type ===  'image/gif' 
                || req.files.image.type === 'image/jpg' 
                || req.files.image.type === 'image/png'
                || req.files.image.type === 'image/jpeg')) {
            res.status(400).json({
                error: "invalid file(image only)"
            });
            return;        
        }

        db.PublicAlarm.findOne({
            where: {
                index: Number(req.query.index)
            }
        }).then((alarm) => {
            if (!alarm) {
                res.status(424).json({
                    error: "no such alarm"
                });
                return;
            } else {
                deleteParams.Key = "public-alarm-images/" + Number(req.query.index).toString() + util.getExtension(alarm.dataValues.imageUrl);
                s3.deleteObject(deleteParams, (err, data) => {
                    if (err) {
                        res.status(424).json({
                            error: "s3 delete failed"
                        });
                        return;
                    } else {
                        addParams.Key = "public-alarm-images/" + Number(req.query.index).toString() + util.getExtension(req.files.image.name);
                        addParams.Body = require('fs').createReadStream(req.files.image.path);
                        addObj.imageUrl = config.s3Url + addParams.Key;
                        s3.putObject(addParams, (err, data) => {
                            if (err) {
                                res.status(424).json({
                                    error: "s3 add failed"
                                });
                                return;
                            } else {
                                db.PublicAlarm.update(
                                    addObj,
                                    {
                                        where: {
                                            index: Number(req.query.index)
                                        }
                                    }
                                ).then((result) => {
                                    if (!result) {
                                        res.status(424).json({
                                            error: "alarm update failed"
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
    > admin이 전체 알림을 삭제
    > DELETE /api/alarm/publicAlarm?index=1
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것. req.query.index로 삭제하고자 하는 알람의 index 전달
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "invalid file(image only)": 전달된 파일이 이미지 파일이 아님
          "no such alarm": 존재하지 않는 알람
          "s3 delete failed": s3 버켓 안의 이미지 삭제 실패
          "alarm delete failed": 알림이 삭제되지 않음
          "unauthorized request": 권한 없는 사용자가 접근
      }
    > success : {
        true: 성공적으로 삭제 완료
      } 
*/
router.delete('/publicAlarm', (req, res) => {
    let token = req.headers['authorization'];

    const params = {
        Bucket: config.s3Bucket,
        Key: null
    };

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }

        if (token.index !== 1) {
            req.status(403).json({
                error: "unauthorized request"
            });
            return;
        }

        db.PublicAlarm.findOne({
            where: {
                index: Number(req.query.index)
            }
        }).then((alarm) => {
            if (!alarm) {
                res.status(424).json({
                    error: "no such alarm"
                });
                return;
            } else {
                params.Key = "public-alarm-images/" + Number(req.query.index).toString() + util.getExtension(alarm.dataValues.imageUrl);
                s3.deleteObject(params, (err, data) => {
                    if (err) {
                        res.status(424).json({
                            error: "s3 delete failed"
                        });
                        return;
                    } else {
                        db.PublicAlarm.destroy({
                            where: {
                                index: Number(req.query.index)
                            }
                        }).then((result) => {
                            if (!result) {
                                res.status(424).json({
                                    error: "alarm delete failed"
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
    > 유저가 로그인 했을 때 알람의 리스트를 불러오는 api
    > GET /api/alarm/publicAlarm
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
      }
    > [
        결과를 배열로 전달. 읽지 않은 알림을 우선적으로 소트해서 보여줌.
      ]
*/
router.get('/publicAlarm', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then(async (member) => {
            if (!member) {
                res.status(424).json({
                    error: "no such member"
                });
                return;
            } else {
                const publicAlarms = await member.getPublicAlarms();

                if (publicAlarms.length > 1) {
                    await publicAlarms.sort((alarm1, alarm2) => {
                        return alarm1.MemberToPublicAlarm.read < alarm2.MemberToPublicAlarm.read ? -1 
                            : alarm1.MemberToPublicAlarm.read > alarm2.MemberToPublicAlarm.read ? 1 : 0;
                    });
                }
                res.json(publicAlarms);
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
    > 유저가 알림을 열어서 다 읽으면 다 읽었다고 날려주면 읽은 걸로 업데이트해주는 api
    > PUT /api/alarm/publicRead
    > header에 token을 넣어서 요청. token 앞에 "Bearer " 붙일 것.
    > error: {
          "invalid request": 올바른 req가 전달되지 않음
          "no such member": 존재하지 않는 회원
          "update failed": 업데이트 실패
      }
    > [
        결과를 배열로 전달. 읽지 않은 알림을 우선적으로 소트해서 보여줌.
      ]
*/
router.put('/publicRead', (req, res) => {
    let token = req.headers['authorization'];

    util.decodeToken(token, res).then((token) => {
        if (!token.index || !token.email || !token.nickName) {
            req.status(400).json({
                error: "invalid request"
            });
            return;
        }

        db.MemberInfo.findOne({
            where: {
                index: token.index
            }
        }).then(async (member) => {
            if (!member) {
                res.status(424).json({
                    error: "no such member"
                });
                return;
            } else {
                const publicAlarms = await member.getPublicAlarms();

                for (let i=0; i<publicAlarms.length; ++i) {
                    await db.MemberToPublicAlarm.update(
                        {
                            read: true
                        },
                        {
                            where: {
                                member_info_index: token.index,
                                public_alarm_index: publicAlarms[i].dataValues.index
                            }
                        }
                    ).then((result) => {
                        if (!result) {
                            res.status(424).json({
                                error: "update failed"
                            });
                            return;
                        }
                    });
                }

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

module.exports = router;