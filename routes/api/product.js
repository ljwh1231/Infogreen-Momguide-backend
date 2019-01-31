const express = require("express");
const router = express.Router();

const db = require("../../models/index");
const Op = db.sequelize.Op;
const categoryObject = {
    'cosmetic': {
        'soap': '워시',
        'lotion': '로션',
        'cream': '크림',
        'oil': '오일',
        'powder': '파우더',
        'haircare': '헤어케어',
        'suncare': '선케어',
        'tissue': '물티슈',
        'lipcare': '립케어',
        'other': '기타화장품'
    },
    'living': {
        'laundry': '세탁세제',
        'fabric': '섬유유연제',
        'dishwashing': '주방세제',
        'odor': '탈취·방향제'
    }
}
/*  
    인기 제품 5가지
    body : {
        mainCategory: 'mainCategory',
        subCategory: 'subCatebory'
    }
}*/
router.get('/api/popularRank', (req, res) => {
    if (req.body.mainCategory === 'cosmetic') {
        if(req.body.subCategory === 'soap') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '워시'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'lotion') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '로션'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'cream') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '크림'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'oil') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '오일'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'powder') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '파우더'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'haircare') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '헤어케어'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'suncare') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '선케어'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'tissue') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '물티슈'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'lipcare') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '립케어'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'other') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '기타화장품'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });
        }
    } else {
        if (req.body.subCategory === 'laundry') {
            db.LivingDB.findAll({
                limit: 5,
                where: {
                    'category': '세탁세제'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'fabric') {
            db.LivingDB.findAll({
                limit: 5,
                where: {
                    'category': '섬유유연제'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'dishwashing') {
            db.LivingDB.findAll({
                limit: 5,
                raw: true,
                where: {
                    'category': '주방세제'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });

        } else if (req.body.subCategory === 'odor') {
            db.LivingDB.findAll({
                limit: 5,
                where: {
                    'category': '탈취·방향제'
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            })
        } else if (req.body.subCategory === 'other') {
            db.LivingDB.findAll({
                limit: 5,
                where: {
                    [Op.or]: [{'category': null}, { 'category': '기타세정제'}]
                },
                order: [
                    ['viewNum', 'DESC']
                ]
            }).done(function(err, result) {
                if (err) {
                    console.log(err)
                    res.json(err);
                }
                else {
                    res.json(result);
                }
            });
        };
    };
});

/*
    제품 상세 페이지
    body: {
        category: 'category',
        productId: 'id'
    }
*/

router.get('/api/details', (req, res) => {
    const category = req.body.category;
    const id = req.body.productId;
    if(category === 'living') {
        db.LivingIngredient.findAll({
            include: [{
                model: db.LivingDB,
                through: {
                    attributes: ['createdAt', 'startedAt', 'finishedAt'],
                    where: {'living_index': id},
                },
                required:  true
            }]
        }).then((result) => {
            res.json(result);
        })
    } else if (category === 'cosmetic') {
        db.CosmeticIngredient.findAll({
            include: [{
                model: db.CosmeticDB,
                through: {
                    attributes: ['createdAt', 'startedAt', 'finishedAt'],
                    where: {'cosmetic_index': id},
                },
                required:  true
            }]
        }).then((result) => {
            res.json(result);
        })
    }
});

module.exports = router;