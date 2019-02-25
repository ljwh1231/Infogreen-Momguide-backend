const express = require("express");
const router = express.Router();
const formidable = require("express-formidable");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const db = require("../../models/index");
const util = require("./util");
const config = require("../../config/config");

/*
 * 리뷰 불러오기 : GET /api/review?id=1
 */

router.get('/', async (req, res) => {
    if(!req.query.id) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        const review = await db.ProductReview.findOne({
            where: {
                index: req.query.id
            }
        });
        const reviewImages = await review.getProductReviewImages();
        const additionalReviews = await review.getProductAdditionalReviews();
        res.json({
            review: review,
            images: reviewImages,
            additionalReview: additionalReviews
        });
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 개인 리뷰 목록 불러오기 : GET /api/review/member/list?page=1
 * AUTHORIZATION NEEDED
 */

router.get('/member/list', async (req, res) => {
    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }
        const page = req.query.page ? req.query.page : 1;
        const pageSize = 6;

        const reviews = await member.getProductReviews();
        res.json(reviews.slice((page-1) * pageSize, page * pageSize));
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 상품 리뷰 목록 불러오기 : GET /api/review/product/list?category=living&id=1&page=1
 * AUTHORIZATON NEEDED
 */

router.get('/product/list', async (req, res) => {
    if(!req.query.category || !(req.query.category === 'living' || req.query.category === 'cosmetic') ||
        !req.query.id || isNaN(Number(req.query.id))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const product = (req.query.category === 'living') ?
            await db.LivingDB.findOne({
                where: {
                    index: Number(req.query.id)
                }
            }) :
            await db.CosmeticDB.findOne({
                where : {
                    index: Number(req.query.id)
                }
            });
        const page = req.query.page ? req.query.page : 1;
        const pageSize = 6;

        const reviews = await product.getProductReviews();
        res.json(reviews.slice((page-1) * pageSize, page * pageSize));
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 상품에 대해 리뷰를 작성한 여부 불러오기 : GET /api/review/status?category=living&id=1
 * AUTHORIZATION NEEDED
 */

router.get('/status', async (req, res) => {
    const category = req.query.category;
    if(!category || !(category === 'living' || category === 'cosmetic') ||
        !req.query.id || isNaN(Number(req.query.id))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }
    const id = Number(req.query.id);

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const reviewExist = await db.sequelize.query(
            `SELECT * FROM product_review WHERE (member_info_index=${member.index} AND ${category}_index=${id});`,
            { type: db.sequelize.QueryTypes.SELECT });

        if(reviewExist.length) {
            res.json({
                exist: true
            });
        } else {
            res.json({
                exist: false
            });
        }
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 상품에 대한 전체 정보 요약 불러오기 : GET /api/review/summary?category=living&id=1
 */

router.get('/summary', async (req, res) => {
    const category = req.query.category;
    const id = req.query.id;

    if(!category || !(category === 'living' || category === 'cosmetic') ||
        !id || isNaN(Number(id))) {
        res.status(400).json({
            error: "invalid request"
        });
    }

    try {
        const product = category === 'living' ?
            await db.LivingDB.findOne({
                where: {
                    index: id
                }
            }) :
            await db.CosmeticDB.findOne({
                where: {
                    index: id
                }
            });

        const reviews = await product.getProductReviews();
        if(reviews.length === 0) {
            res.json({
                rating: 0,
                functionalityCount: [0, 0, 0],
                nonIrritatingCount: [0, 0, 0],
                sentCount: [0, 0, 0],
                costEffectivenessCount: [0, 0, 0],
                images: []
            });
            return;
        }
        const getImagesQuery = `SELECT * FROM product_review_image WHERE` +
            reviews.map((review, i) => {
                if(i === 0)
                    return ` product_review_index=${review.index}`;
                else
                    return ` OR product_review_index=${review.index}`;
            }).join('') + ';';
        let images = reviews.length ? (await db.sequelize.query(getImagesQuery))[0] : [];
        if(images.length !== 0) {
            images = images.sort((a, b) => a.index > b.index ? -1 : 1).slice(0, 10);
        }

        const countFunction = (array, key, value) => {
            return array.filter((item) => item[key] === value).length;
        };

        res.json({
            rating: product.rateSum / product.rateCount,
            functionalityCount: [1, 2, 3].map((num) => countFunction(reviews, 'functionality', num)),
            nonIrritatingCount: [1, 2, 3].map((num) => countFunction(reviews, 'nonIrritating', num)),
            sentCount: [1, 2, 3].map((num) => countFunction(reviews, 'sent', num)),
            costEffectivenessCount: [1, 2, 3].map((num) => countFunction(reviews, 'costEffectiveness', num)),
            images: images
        });
    } catch(e) {
        console.log(e);
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 리뷰 등록하기 : POST /api/review
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (FORM-DATA) : {
 *  "category": "living",
 *  "productId": "1",
 *  "rating": "5",        (1~5)
 *  "useMonth": "3",      (1~12)
 *  "content": "text",
 *  "functionality": "1", (1~3)
 *  "nonIrritating": "2", (1~3)
 *  "sent": "3",          (1~3)
 *  "costEffectiveness": "1", (1~3)
 *  "images": (binary)  (선택사항)
 * }
 */

router.post('/', formidable({multiples: true}), async (req, res) => {
    if((req.fields.category !== 'living' && req.fields.category !== 'cosmetic') ||
            isNaN(Number(req.fields.productId)) ||
            isNaN(Number(req.fields.rating))|| !(req.fields.rating >= 1 && req.fields.rating <= 5) ||
            isNaN(Number(req.fields.useMonth)) || !(req.fields.useMonth >= 1 && req.fields.useMonth <= 12) ||
            isNaN(Number(req.fields.functionality)) || !(req.fields.functionality >= 1 && req.fields.functionality <= 3) ||
            isNaN(Number(req.fields.nonIrritating)) || !(req.fields.nonIrritating >= 1 && req.fields.nonIrritating <= 3) ||
            isNaN(Number(req.fields.sent)) || !(req.fields.sent >= 1 && req.fields.sent <= 3) ||
            isNaN(Number(req.fields.costEffectiveness)) || !(req.fields.costEffectiveness >= 1 && req.fields.costEffectiveness <= 3)) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    const moment = require('moment');
    const reviewObject = {
        rating: Number(req.fields.rating),
        baseDate: moment().subtract(Number(req.fields.useMonth), 'months'),
        content: req.fields.content ? req.fields.content : '',
        functionality: Number(req.fields.functionality),
        nonIrritating: Number(req.fields.nonIrritating),
        sent: Number(req.fields.sent),
        costEffectiveness: Number(req.fields.costEffectiveness),
    };

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        let product = null;
        if(req.fields.category === 'living') {
            product = await db.LivingDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        } else {
            product = await db.CosmeticDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        }

        if(!member || !product) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const reviewExist = await db.sequelize.query(
            `SELECT * FROM product_review WHERE (member_info_index=${member.index} AND ${req.fields.category}_index=${product.index});`,
            { type: db.sequelize.QueryTypes.SELECT });
        if(reviewExist.length) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }
        const review = await db.ProductReview.create(reviewObject);
        member.addProductReview(review);
        product.addProductReview(review);
        product.rateCount += 1;
        product.rateCount += reviewObject.rating;
        await product.save();

        let images = req.files.images;
        if(typeof images === 'object' && !images.length) {
            images = [images];
        }
        if(images && images.length) {
            const imageObjectArray = [];

            for (let i = 0; i < images.length; i++) {
                const image = images[i];

                const params = {
                    Bucket: config.s3Bucket,
                    Key: `review-images/${review.index}-${i}${util.getExtension(image.name)}`,
                    ACL: 'public-read',
                    Body: require('fs').createReadStream(image.path)
                };

                await s3.putObject(params).promise();
                imageObjectArray.push({
                    url: `https://s3.ap-northeast-2.amazonaws.com/infogreenmomguide/review-images/${review.index}-${i}${util.getExtension(image.name)}`
                });
            }
            const imageObjects = await db.ProductReviewImage.bulkCreate(imageObjectArray);
            review.setProductReviewImages(imageObjects);
        }

        res.json(review);
    } catch (e) {
        console.log(e);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

/*
 * 리뷰 수정하기 : PUT /api/review
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (FORM-DATA) {
 *  "reviewId": 1,
 *  "category": "living",
 *  "productId": 1,
 *  "rating": 5
 *  "content": "text",
 *  "functionality": 1,
 *  "nonIrritating": 2,
 *  "sent": 3,
 *  "costEffectiveness": 1,
 *  "images": (binary)
 * }
 */

router.put('/', formidable({multiples: true}), async (req, res) => {
    if(isNaN(Number(req.fields.reviewId)) ||
        isNaN(Number(req.fields.rating))|| !(req.fields.rating >= 1 && req.fields.rating <= 5) ||
        isNaN(Number(req.fields.functionality)) || !(req.fields.functionality >= 1 && req.fields.functionality <= 3) ||
        isNaN(Number(req.fields.nonIrritating)) || !(req.fields.nonIrritating >= 1 && req.fields.nonIrritating <= 3) ||
        isNaN(Number(req.fields.sent)) || !(req.fields.sent >= 1 && req.fields.sent <= 3) ||
        isNaN(Number(req.fields.costEffectiveness)) || !(req.fields.costEffectiveness >= 1 && req.fields.costEffectiveness <= 3)) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    const reviewModifyObject = {
        rating: Number(req.fields.rating),
        content: req.fields.content ? req.fields.content : '',
        functionality: Number(req.fields.functionality),
        nonIrritating: Number(req.fields.nonIrritating),
        sent: Number(req.fields.sent),
        costEffectiveness: Number(req.fields.costEffectiveness),
    };

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        let product = null;
        if(req.fields.category === 'living') {
            product = await db.LivingDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        } else {
            product = await db.CosmeticDB.findOne({
                where: {
                    index: req.fields.productId
                }
            });
        }

        if(!member || !product) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: req.fields.reviewId
            }
        });

        if(!review || (review.member_info_index !== member.index)) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        product.ratingSum -= review.rating;
        product.ratingSum += reviewModifyObject.rating;
        await product.save();
        await review.update(reviewModifyObject);

        await db.ProductReviewImage.destroy({where: {product_review_index: review.index}});

        const images = req.files.images;
        if(images) {
            const imageObjectArray = [];

            for (let i = 0; i < images.length; i++) {
                const image = images[i];

                const params = {
                    Bucket: config.s3Bucket,
                    Key: `review-images/${review.index}-${i}${util.getExtension(image.name)}`,
                    ACL: 'public-read',
                    Body: require('fs').createReadStream(image.path)
                };

                await s3.putObject(params).promise();
                imageObjectArray.push({
                    url: `https://s3.ap-northeast-2.amazonaws.com/infogreenmomguide/review-images/${review.index}-${i}${util.getExtension(image.name)}`
                });
            }
            const imageObjects = await db.ProductReviewImage.bulkCreate(imageObjectArray);
            review.setProductReviewImages(imageObjects);
        }

        res.json(review);
    } catch (e) {
        console.log(e);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

/*
 * 리뷰 삭제하기 : DELETE /api/review
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (JSON) {
 *  "reviewId": 1
 * }
 */

router.delete('/', async (req, res) => {
    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: req.body.reviewId
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }
        await review.destroy();

        res.json({success: true});
    } catch (e) {
        console.log(e);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

/*
 * 추가 리뷰 목록 불러오기 : GET /api/review/addition?reviewId=1
 */

router.get('/addition', async (req, res) => {
    try {
        const reviewId = req.query.reviewId;

        const review = await db.ProductReview.findOne({
            where: {
                index: reviewId
            }
        });

        const reviews = await review.getProductAdditionalReviews();
        res.json(reviews);
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 추가 리뷰 추가하기 : POST /api/review/addition
 * AUTHORIZATION NEEDED
 * BODY SAMPlE (JSON) : {
 *  reviewId: 1,
 *  content: 'text'
 * }
 */

router.post('/addition', async (req, res) => {
    if(!req.body.reviewId || isNaN(Number(req.body.reviewId)) ||
        !req.body.content) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: req.body.reviewId
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const moment = require('moment');
        const additionalReview = await db.ProductAdditionalReview.create({
            date: moment(),
            content: req.body.content
        });

        review.addProductAdditionalReview(additionalReview);
        res.json(additionalReview);
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 추가 리뷰 수정하기 : PUT /api/review/addition
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (JSON) : {
 *  additionalReviewId: 1,
 *  content: 'text'
 * }
 */

router.put('/addition', async (req, res) => {
    if(!req.body.additionalReviewId || isNaN(Number(req.body.additionalReviewId)) ||
        !req.body.content) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const additionalReview = await db.ProductAdditionalReview.findOne({
            where: {
                index: req.body.additionalReviewId
            }
        });

        if(!additionalReview) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: additionalReview.product_review_index
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        additionalReview.content = req.body.content;
        additionalReview.save();

        res.json(additionalReview);
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }
});

/*
 * 추가 리뷰 삭제하기 : DELETE /api/review/addition
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (JSON) : {
 *  additionalReviewId: 1
 * }
 */

router.delete('/addition', async (req, res) => {
    if(!req.body.additionalReviewId || isNaN(Number(req.body.additionalReviewId))) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        let token = req.headers['authorization'];
        token = await util.decodeToken(token);

        if (!token.index || !token.email || !token.nickName) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        const member = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const additionalReview = await db.ProductAdditionalReview.findOne({
            where: {
                index: req.body.additionalReviewId
            }
        });

        if(!additionalReview) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            where: {
                index: additionalReview.product_review_index
            }
        });

        if(review.member_info_index !== member.index) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        additionalReview.destroy();

        res.json({
            success: true
        });
    } catch(e) {
        res.status(400).json({
            error: "invalid request"
        });
    }

});

module.exports = router;
