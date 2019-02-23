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
 */

router.get('/api/review/product/list', async (req, res) => {
    if(!req.query.category || !req.query.id) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    try {
        // TODO: 얼마만큼 보여줄지 기획에 따라 달라짐
    } catch(e) {
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

        const images = req.files.images;
        if(images) {
            const imageObjectArray = [];

            for (let i = 0; i < images.length; i++) {
                const image = images[i];

                const params = {
                    Bucket: config.s3Bucket,
                    Key: `review-images/${review.index}-${i}.${util.getExtension(image.name)}`,
                    ACL: 'public-read',
                    Body: require('fs').createReadStream(image.path)
                };

                await s3.putObject(params).promise();
                imageObjectArray.push({
                    url: `https://s3.ap-northeast-2.amazonaws.com/review-images/${review.index}-${i}${util.getExtension(image.name)}`
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

        if(!member) {
            res.status(400).json({
                error: 'invalid request'
            });
            return;
        }

        const review = await db.ProductReview.findOne({
            index: req.fields.reviewId
        });

        if(!review || (review.member_info_index !== member.index)) {
            res.status(400).json({
                error: "invalid request"
            });
            return;
        }

        await db.ProductReviewImage.destroy({where: {product_review_index: review.index}});
        console.log(await review.getProductReviewImages());

        const images = req.files.images;
        if(images) {
            const imageObjectArray = [];

            for (let i = 0; i < images.length; i++) {
                const image = images[i];

                const params = {
                    Bucket: config.s3Bucket,
                    Key: `review-images/${review.index}-${i}.${util.getExtension(image.name)}`,
                    ACL: 'public-read',
                    Body: require('fs').createReadStream(image.path)
                };

                await s3.putObject(params).promise();
                imageObjectArray.push({
                    url: `https://s3.ap-northeast-2.amazonaws.com/review-images/${review.index}-${i}${util.getExtension(image.name)}`
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

        console.dir(review);
        console.log(review.member_info_index, member.index);
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

module.exports = router;
