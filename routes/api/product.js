const express = require("express");
const route = express.Router();

const db = require("../../models/index");

/* body : {
    mainCategory: 'mainCategory',
    subCategory: 'subCatebory'
}*/
route.get('/popularRank', (req, res) => {
    if (req.body.mainCategory === 'cosmetic') {
        if(req.body.subCategory === 'soap') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '워시'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'lotion') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '로션'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'cream') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '크림'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'oil') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '오일'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'powder') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '파우더'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'haircare') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '헤어케어'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'suncare') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '선케어'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'tissue') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '물티슈'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'lipcare') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '립케어'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        } else if (req.body.subCategory === 'other') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '기타화장품'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(cosmetics => res.json(cosmetics))
        }
    } else {
        if (req.body.subCategory === 'laundry') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '세탁세제'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(livings => res.json(livings))
        } else if (req.body.subCategory === 'fabric') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '섬유유연제'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(livings => res.json(livings))
        } else if (req.body.subCategory === 'dishwashing') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '주방세제'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(livings => res.json(livings))
        } else if (req.body.subCategory === 'odor') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    'category': '탈취·방향제'
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(livings => res.json(livings))
        } else if (req.body.subCategory === 'other') {
            db.CosmeticDB.findAll({
                limit: 5,
                where: {
                    [Op.or]: [{'category': null}, { 'category': '기타세정제'}]
                },
                order: [
                    db.sequelize.fn('max', db.sequelize.col('view_num'))
                ]
            }).then(livings => res.json(livings))
        }
    }
})