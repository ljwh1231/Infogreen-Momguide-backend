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
                console.log(err);
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
                console.log(err);
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
    /api/category?search=name&mainCategory=cosmetic&subCategory=soap&careExclude=true&harmExclude=true
                  &highDangerExclude=true&middleDangerExclude=true&ingredient=true&eco=true&sort=rate&page=1

    sort = rate, view, recent 중 1개의 값일때만 제대로 처리됨
*/
router.get('/api/category', (req, res) => {
    const searchInput = typeof req.query.search === 'undefined' ? '' : req.query.search;

    let category = null;
    const mainCategory = req.query.mainCategory;
    const subCategory = req.query.subCategory;
    if(typeof mainCategory !== 'undefined' && typeof subCategory !== 'undefined' && mainCategory in categoryObject &&
            subCategory in categoryObject[mainCategory]) {
        category = categoryObject[mainCategory][subCategory];
    }

    // 주의 성분 제외 true면 제외시킴
    const careExclude = req.query.careExclude === 'true';
    // 유해 성분 제외 true면 제외
    const harmExclude = req.query.harmExclude === 'true';
    // 높은 위험 성분 제외 true면 제외
    const highDangerExclude = req.query.highDangerExclude === 'true';
    // 중간 위험 성분 제외 true면 제외
    const middleDangerExclude = req.query.middleDangerExclude === 'true';
    // 친환경 인증 제품 true면 인증된 제품
    //  TODO : eco값 db에 맞추서 수정
    const eco = req.query.eco === 'true';
    // 성분 공개 제품 true면 공개
    const ingredient = req.query.ingredient === 'true';

    const sort = req.query.sort;
    const page = isNaN(Number(req.query.page)) ? 1 : Number(req.query.page);

    // 한 페이지에 보여줄 항목 개수
    let limit = 20;

    let orderOption = {

    };
    if (sort === 'view') {
        orderOption = {
            order: [['viewNum', 'DESC']]
        };
    } else if (sort === 'rate') {
        orderOption = {
            order : [[
                [db.sequelize.literal('rateSum / rateCount DESC')]
            ]]
        };
    } else if (sort === 'recent') {
        orderOption = {
            order: [['index', 'DESC']]
        };
    }

    let whereOption = {
        $or: [
            {
                'name': db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('name')), 'LIKE', '%' + searchInput.toLowerCase() + '%')
            },
            {
                'brand': db.sequelize.where(db.sequelize.fn('LOWER', db.sequelize.col('brand')), 'LIKE', '%' + searchInput.toLowerCase() + '%')
            }
        ]
    };
    if(category !== null)
        whereOption['category'] = category;

    if(mainCategory === 'cosmetic') {
        whereOption['includeHighDanger'] = !highDangerExclude;
        whereOption['includeMiddleDanger'] = !middleDangerExclude;
        whereOption['includeCare'] = !careExclude;

        db.CosmeticDB.findAndCountAll({
            where: whereOption
        }).then((data) => {
            let totalPages = Math.ceil(data.count / limit);
            db.CosmeticDB.findAll({
                ...orderOption,
                where: whereOption,
                limit: limit,
                offset: limit * (page - 1)
            }).done(function(result) {
                res.json({data: result, totalPages: totalPages});
            });
        }).catch((err) => {
            res.status(500).json(err);
        });
    } else if (mainCategory === 'living') {
        whereOption['includeDanger'] = !highDangerExclude;
        whereOption['includeToxic'] = !harmExclude;
        whereOption['includeCare'] = !careExclude;
        whereOption['ingredient'] = ingredient;
        whereOption['eco'] = eco;

        db.LivingDB.findAndCountAll({
            where: whereOption
        }).then((data) => {
            let totalPages = Math.ceil(data.count / limit);
            db.LivingDB.findAll({
                ...orderOption,
                where: whereOption,
                limit: limit,
                offset: limit * (page - 1)
            }).done(function (result) {
                res.json({data: result, totalPages: totalPages});
            });
        }).catch((err) => {
            res.status(500).json(err);
        });
    } else {
        /*let totalCount = 0;
        db.CosmeticDB.findAndCountAll({
            where: whereOption
        }).then((data) => {
            totalCount += data.count;
            db.CosmeticDB.findAll({
                ...orderOption,
                where: whereOption,
                limit: limit,
                offset: limit * (page - 1)
            }).done(function (err, result1) {
                if (err) {
                    console.log(err);
                    res.json(err);
                    return;
                }

                db.LivingDB.findAndCountAll({
                    where: whereOption
                }).then((data) => {
                    let totalPages = Math.ceil(data.count+totalCount / limit);
                    db.LivingDB.findAll({
                        ...orderOption,
                        where: whereOption,
                        limit: limit,
                        offset: limit * (page - 1)
                    }).done(function (err, result2) {
                        if (err) {
                            console.log(err);
                            res.json(err);
                        }
                        else {
                            res.json({...result1, ...result2, totalPages: totalPages});
                            console.log({...result1, ...result2, totalPages: totalPages});
                        }
                    });
                });
            });
        });*/

        res.json({
            data: [],
            totalPages: totalPages
        });
    }
});

module.exports = router;