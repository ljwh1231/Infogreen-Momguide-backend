const cron = require('node-cron');
const moment = require('moment');
require('moment-timezone');
const Sequelize = require('sequelize');

const db = require("../models/index");
const config = require("../config/config");

// 한달 되었는지 계산
function calMonth(date1, date2) {
    let diff = Math.floor(moment.duration(date1.diff(date2)).asDays());
    if (diff >= 1) {
        diff -= 1;
    }

    return Math.floor(diff/30);
}

// 스케쥴러 함수. (현재는 추가 리뷰 기능만. 리뷰 테이블 전체를 훑고 추가 리뷰가 필요할 시 개인 알람에 추가.)
function scheduler() {
    cron.schedule('0 0 0 * * *', () => {
        moment.tz.setDefault("Asia/Seoul");
        const currentDate = moment();
        const alarmObj = {};
        let product;

        db.ProductReview.findAll({
            where: {}
        }).then(async (reviews) => {
            for (let i=0; i<reviews.length; ++i) {

                const already = await db.PrivateAlarm.findOne({
                    where: {
                        category: 'additional review',
                        categoryIndex: reviews[i].dataValues.index,
                        member_info_index: reviews[i].dataValues.member_info_index
                    },
                    order: [['created_at', 'DESC']]
                });

                if (already) {
                    if (calMonth(currentDate, reviews[i].dataValues.created_at) === calMonth(moment(already.dataValues.created_at), reviews[i].dataValues.created_at)) {
                        console.log("error: already alarmed");
                        return;
                    }
                }

                const additionalReviews = await reviews[i].getProductAdditionalReviews();
                if (additionalReviews.length === 0) {
                    if (calMonth(currentDate, reviews[i].dataValues.created_at) >= 1) {
                        if (reviews[i].dataValues.cosmetic_index === null) {
                            product = await db.LivingDB.findOne({
                                where: {
                                    index: reviews[i].dataValues.living_index
                                }
                            });
                            alarmObj.imageUrl = config.s3Url 
                                + "product-images/living-product-images/" 
                                + product.dataValues.brand
                                + "/" + product.dataValues.name + ".jpg"; 
                        } else if (reviews[i].dataValues.living_index === null) {
                            product = await db.CosmeticDB.findOne({
                                where: {
                                    index: reviews[i].dataValues.cosmetic_index
                                }
                            })
                            alarmObj.imageUrl = config.s3Url 
                                + "product-images/cosmetic-product-images/" 
                                + product.dataValues.brand 
                                + "/" + product.dataValues.name + ".jpg";
                        }

                        alarmObj.content = product.dataValues.name + "을 사용한지 1개월이 지났습니다.\n2번째 리뷰를 작성해주세요!"
                        alarmObj.linkUrl = "/additional-review/" + reviews[i].dataValues.index.toString();
                        alarmObj.category = "additional review";
                        alarmObj.categoryIndex = reviews[i].dataValues.index;

                        alarmObj.imageUrl = alarmObj.imageUrl.replace(/ /gi, '%20');

                        const member = await db.MemberInfo.findOne({
                            where: {
                                index: reviews[i].dataValues.member_info_index
                            }
                        });

                        if (!member) {
                            console.log("error: no such member");
                            return;
                        }

                        const alarm = await db.PrivateAlarm.create(
                            alarmObj
                        ).catch(Sequelize.ValidationError, (err) => {
                            console.log(err);
                            return;
                        });

                        if (!alarm) {
                            console.log("error: create failed.");
                            return;
                        }

                        member.addPrivateAlarm(alarm);
                    }
                } else {
                    let recentOne;
                    if (additionalReviews.length === 1) {
                        recentOne = additionalReviews[0];
                    } else {    
                        await additionalReviews.sort((review1, review2) => {
                            return review1.dataValues.created_at > review2.dataValues.created_at ? -1
                            : (review1.dataValues.created_at < review2.dataValues.created_at ? 1 : 0);
                        });
                        recentOne = additionalReviews[0];
                    }

                    if (calMonth(currentDate, recentOne.dataValues.created_at) >= 1) {
                        if (reviews[i].dataValues.cosmetic_index === null) {
                            product = await db.LivingDB.findOne({
                                where: {
                                    index: reviews[i].dataValues.living_index
                                }
                            })
                            alarmObj.imageUrl = config.s3Url 
                                + "product-images/living-product-images/" 
                                + product.dataValues.brand 
                                + "/" + product.dataValues.name + ".jpg";
                        } else if (reviews[i].dataValues.living_index === null) {
                            product = await db.CosmeticDB.findOne({
                                where: {
                                    index: reviews[i].dataValues.cosmetic_index
                                }
                            })
                            alarmObj.imageUrl = config.s3Url 
                                + "product-images/cosmetic-product-images/" 
                                + product.dataValues.brand 
                                + "/" + product.dataValues.name + ".jpg";
                        }

                        const month = (Math.floor(moment.duration(currentDate.diff(recentOne.dataValues.created_at)).asDays())-1)/30;

                        alarmObj.content = product.dataValues.name + "을 사용한지 " + month.toString() + "개월이 지났습니다.\n" + (month+1).toString() + "번째 리뷰를 작성해주세요!"
                        alarmObj.linkUrl = "/additional-review/" + reviews[i].dataValues.index.toString();
                        alarmObj.category = "additional review";
                        alarmObj.categoryIndex = reviews[i].dataValues.index;

                        alarmObj.imageUrl.replace(/ /gi, '%20');

                        const member = await db.MemberInfo.findOne({
                            where: {
                                index: reviews[i].dataValues.member_info_index
                            }
                        });

                        if (!member) {
                            console.log("error: no such member");
                            return;
                        }

                        const alarm = await db.PrivateAlarm.create(
                            alarmObj
                        ).catch(Sequelize.ValidationError, (err) => {
                            console.log(err);
                            return;
                        });

                        if (!alarm) {
                            console.log("error: create failed.");
                            return;
                        }

                        member.addPrivateAlarm(alarm);
                    }
                }
            }
        });
    });
}

scheduler();