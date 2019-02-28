const cron = require('node-cron');
const moment = require('moment');
require('moment-timezone');

const db = require("../models/index");

// 스케쥴러 함수. (현재는 추가 리뷰 기능만. 리뷰 테이블 전체를 훑고 추가 리뷰가 필요할 시 개인 알람에 추가.)
function scheduler() {
    cron.schedule('*/1 * * * *', () => {
        moment.tz.setDefault("Asia/Seoul");
        const currentDate = moment();

        db.ProductReview.findAll({
            where: {}
        }).then(async (reviews) => {
            for (let i=0; i<reviews.length; ++i) {
                const additionalReviews = await getProductAdditionalReviews();
                if (additionalReviews.length === 0) {
                    if (moment.duration(currentDate.diff(reviews[i].dataValues.created_at)).asDays() > 30) {
                        
                    }
                } else {

                }
            }
        });
    });
}

scheduler();