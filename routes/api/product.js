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
        'odor': '탈취·방향제',
        'other': '기타세정제'
    }
};

/*  
    인기 제품 5가지
    /api/popularRank?mainCategory=cosmetic&subCategory=soap
}*/
router.get('/api/popularRank', (req, res) => {
    const mainCategory = req.query.mainCategory;
    const subCategory = req.query.subCategory;
    
    if(typeof mainCategory === 'undefined' || typeof subCategory === 'undefined') {
        res.status(400).send();
        return;
    }

    if(!(mainCategory in categoryObject) || !(subCategory in categoryObject[mainCategory])) {
        res.status(400).send();
        return;
    }

    let queryCondition = {
        'category': categoryObject[mainCategory][subCategory]
    };
    if(subCategory === 'other') {
        queryCondition = {
            [Op.or]: [{'category': null}, {'category': categoryObject[mainCategory][subCategory]}]
        };
    }
    //console.log(queryCondition);
    if(mainCategory === 'cosmetic') {
        db.CosmeticDB.findAll({
            limit: 5,
            where: queryCondition,
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
    } else if (mainCategory === 'living') {
        db.LivingDB.findAll({
            limit: 5,
            where: queryCondition,
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
});

/*
    제품 상세 페이지
    /api/details?category=living&productId=1
*/

router.get('/api/details', (req, res) => {
    const category = req.query.category;
    const id = req.query.productId;

    if(typeof category === 'undefined' || typeof id === 'undefined') {
        console.log('sdfwfwfsdf');
        res.status(400).send();
        return;
    }

    if(!(category in categoryObject)) {
        console.log('debug1123123');
        res.status(400).send();
        return;
    }

    if(category === 'cosmetic') {
        db.CosmeticDB.findOne({
            where: {'index': id}
        }).then((result) => {
            result.update({viewNum: result.dataValues.viewNum + 1});
            db.CosmeticIngredient.findAll({
                include: [{
                    model: db.CosmeticDB,
                    through: {
                        attributes: ['createdAt', 'startedAt', 'finishedAt'],
                        where: {'cosmetic_index': id}
                    },
                    required: true
                }]
            }).then((result) => {
                res.json(result);
            }).catch((err) => {
                console.log(err);
            });
        }).catch((err) => {
            console.log(err);
        });
    } else if (category === 'living') {
        console.log('debug1');
        db.LivingDB.findOne({
            where: {'index': id}
        }).then((result) => {
            result.update({viewNum: result.dataValues.viewNum + 1});
            db.CosmeticIngredient.findAll({
                include: [{
                    model: db.LivingDB,
                    through: {
                        attributes: ['createdAt', 'startedAt', 'finishedAt'],
                        where: {'living_index': id}
                    },
                    required: true
                }]
            }).then((result) => {
                res.json(result);
            }).catch((err) => {
                console.log(err);
            })
        }).catch((err) => {
            console.log(err);
        });
    }
});

/*
    성분 좋은 제품
    /api/goodIngredientItem?mainCategory=cosmetic&subCategory=soap
*/

router.get('/api/goodIngredientItem', (req, res) => {
    const mainCategory = req.query.mainCategory;
    const subCategory = req.query.subCategory;

    if(typeof mainCategory === 'undefined' || typeof subCategory === 'undefined') {
        res.status(400).send();
        return;
    }

    if(!(mainCategory in categoryObject) || !(subCategory in categoryObject[mainCategory])) {
        res.status(400).send();
        return;
    }

    if(mainCategory === 'cosmetic') {
        db.CosmeticDB.findAll({
            limit: 5,
            where: {
                'category': categoryObject[mainCategory][subCategory],
                'includeHighDanger': false,
                'includeMiddleDanger': false,
                'includeCare': false
            },
            order: db.sequelize.literal('rand()')
        }).done(function(err, result) {
            if (err) {
                console.log(err)
                res.json(err);
            }
            else {
                res.json(result);
            }
        });
    } else if (mainCategory === 'living') {
        db.LivingDB.findAll({
            limit: 5,
            where: {
                'category': categoryObject[mainCategory][subCategory],
                'includeDanger': false,
                'includeToxic': false,
                'includeCare': false
            },
            order: db.sequelize.literal('rand()')
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
});

/*
    Category page
    /api/category?search=name&mainCategory=cosmetic&subCategory=soap&highDanger=true&middleDanger=true&care=true&danger=true&toxic=true&ingredient=true&eco=true&sort=rate&page=1
*/
/*
router.get('/api/category', (req, res) => {
    //const name = req.query.search;
    const name = '';
    const mainCategory = req.query.mainCategory;
    const subCategory = req.query.subCategory;
    const highDanger = req.query.highDanger;
    const middleDanger = req.query.care;
    const care = req.query.care;
    const danger = req.query.danger;
    const toxic = req.query.toxic;
    const ingredient = req.query.ingredient;
    const eco = req.query.eco === 'true' ? 'O':''; //TODO : eco값 db에 맞추서 수정
    const sort = req.query.sort;
    const page = req.query.page;

    let limit = 20;
    let offset = 0;

    let sortOption;
    if (sort === 'view') {
        sortOption = ['viewNum', 'DESC'];
    } else if (sort === 'rate') {
        sortOption = [
            [db.sequelize.literal('rateSum / rateCount DESC')]
        ]
    } else if (sort === 'late') {
        sortOption = ['index', 'DESC'];
    }
    let lowerName = name.toLowerCase();
    if(mainCategory === 'cosmetic') {
        db.CosmeticDB.findAll({
            where: {
                'name': db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('name')), 'LIKE', '%' + lowerName + '%'),
                'category': categoryObject[mainCategory][subCategory],
                'includeHighDanger': highDanger,
                'includeMiddleDanger': middleDanger,
                'includeCare': care,
            },
            order: [
                sortOption
            ],
            limit: limit,
            offset: limit * (page - 1)
        }).done(function(err, result) {
            if (err) {
                console.log(err)
                res.json(err);
            }
            else {
                console.log(result);
                res.json(result);
            }
        });
    } else if (mainCategory === 'living') {
        db.LivingDB.findAll({
            limit: limit,
            offset: limit * (page - 1),
            where: {
                'name': db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('name')), 'LIKE', '%' + lowerName + '%'),
                'category': categoryObject[mainCategory][subCategory],
                'includeDanger': danger,
                'includeToxic': toxic,
                'includeCare': care,
                'ingredient': ingredient,
                'eco': eco
            },
            order: [
                sortOption
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
})
*/
module.exports = router;