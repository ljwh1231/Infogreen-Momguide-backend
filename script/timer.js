const cron = require('node-cron');
const moment = require('moment');
require('moment-timezone');
const Sequelize = require('sequelize');

const db = require("../models/index");
const config = require("../config/config");

// 스케쥴러 함수. (현재는 추가 리뷰 기능만. 리뷰 테이블 전체를 훑고 추가 리뷰가 필요할 시 개인 알람에 추가.)
function scheduler() {
    cron.schedule('*/1 * * * *', () => {
        moment.tz.setDefault("Asia/Seoul");
        const currentDate = moment();
        const alarmObj = {};
        let product;

        db.ProductReview.findAll({
            where: {}
        }).then(async (reviews) => {
            for (let i=0; i<reviews.length; ++i) {
                const additionalReviews = await getProductAdditionalReviews();
                if (additionalReviews.length === 0) {
                    if (moment.duration(currentDate.diff(reviews[i].dataValues.created_at)).asDays() > 30) {
                        if (reviews[i].dataValues.cosmetic_index === null) {
                            product = await db.LivingDB.findOne({
                                where: {
                                    index: reviews[i].dataValues.living_index
                                }
                            })
                            alarmObj.imageUrl = config.s3Url 
                                + "/product-images/living-product-images/" 
                                + product.dataValues.brand 
                                + "/" + product.dataValues.name + ".jpg";
                        } else if (reviews[i].dataValues.living_index === null) {
                            product = await db.CosmeticDB.findOne({
                                where: {
                                    index: reviews[i].dataValues.cosmetic_index
                                }
                            })
                            alarmObj.imageUrl = config.s3Url 
                                + "/product-images/cosmetic-product-images/" 
                                + product.dataValues.brand 
                                + "/" + product.dataValues.name + ".jpg";
                        }

                        alarmObj.content = product.dataValues.name + "을 사용한지 1개월이 지났습니다.\n2번째 리뷰를 작성해주세요!"
                        alarmObj.linkUrl = "/additional-review/" + reviews[i].dataValues.index.toString();
                        alarmObj.category = "additional review";
                        alarmObj.categoryIndex = reviews[i].dataValues.index;

                        const result = await db.PrivateAlarm.create(
                            alarmObj
                        ).catch(Sequelize.ValidationError, (err) => {
                            console.log(err);
                            return;
                        });

                        if (!result) {
                            console.log("error: create failed.");
                            return;
                        }
                    }
                } else {
                    let recentOne;
                    if (additionalReviews.length === 1) {
                        recentOne = additionalReviews[0];
                    } else {    
                        
                    }
                }
            }
        });
    });
}

scheduler();