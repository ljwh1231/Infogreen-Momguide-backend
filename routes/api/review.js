const express = require("express");
const router = express.Router();
const formidable = require("express-formidable");
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const db = require("../../models/index");
const Op = db.sequelize.Op;
const util = require("./util");
const config = require("../../config/config");

/*
 * 리뷰 불러오기 : GET /api/review?
 */

router.get('/', (req, res) => {
});

/*
 * 리뷰 등록하기 : POST /api/review
 * AUTHORIZATION NEEDED
 * BODY SAMPLE (FORM-DATA) : {
 *  "category": "living",
 *  "id": "1",
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
            isNaN(Number(req.fields.id)) ||
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
        content: req.fields.content,
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

        const infoResult = await db.MemberInfo.findOne({
            where: {
                index: token.index,
                email: token.email,
                nickName: token.nickName
            }
        });

        if (!infoResult) {
            res.status(424).json({
                error: "no info"
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
                    index: req.fields.id
                }
            });
        } else {
            product = await db.CosmeticDB.findOne({
                where: {
                    index: req.fields.id
                }
            });
        }

        const review = await db.ProductReview.create({
            ...reviewObject
        });
        member.addProductReview(review);
        product.addProductReview(review);

        const images = req.files.images;
        const imageObjectArray = [];

        for(let i = 0; i < images.length; i++) {
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

        res.json(review);
    } catch (e) {
        console.log(e);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

module.exports = router;
