const fs = require("fs");
const csv = require("csv");
const model = require("../models");

const livingData = fs.createReadStream('./data/dbliving.csv');

const parser = csv.parse({
    delimiter: ',',
    column: true
});

// 고유번호, 제품이름, 브랜드, 제조사, 카테고리, 성분공개, 자가검사번호, 기타허가인증여부, 친환경인증여부, 해외인증여부, 조회수, 총별점, 별점인원
const transformLiving = csv.transform(function(row) {
    const index = Number(row[0]);
    if(isNaN(index)) {
        console.log("고유번호에 숫자가 아닌 값이 들어있습니다.");
        console.log(row[0]);
        return;
    }
    const name  = row[1];
    const brand = row[2];
    const madeBy = row[3];
    const category = row[4];
    const ingredient = row[5];
    const testNum = row[6];
    const permit = row[7];
    const eco = row[8];
    const foreignCertificate = row[9];

    const viewNum = row[10] === '' ? 0 : Number(row[10]);
    if(isNaN(viewNum)) {
        console.log("조회수에 숫자가 아닌 값이 들어있습니다.");
        console.log(row[10]);
        return;
    }

    const rateSum = row[11] === '' ? 0 : Number(row[11]);
    if(isNaN(rateSum)) {
        console.log("총 별점에 숫자가 아닌 값이 들어있습니다.");
        console.log(row[11]);
        return;
    }

    const rateCount = row[12] === '' ? 0 : Number(row[12]);
    if(isNaN(rateCount)) {
        console.log("별점 인원에 숫자가 아닌 값이 들어있습니다.");
        console.log(row[12]);
        return;
    }

    let resultObj = {
        index: index,
        name: name,
        brand: brand,
        madeBy: madeBy,
        category: category,
        ingredient: ingredient,
        testNum: testNum,
        permit: permit,
        eco: eco,
        foreignCertificate: foreignCertificate,
        viewNum: viewNum,
        rateSum: rateSum,
        rateCount: rateCount
    };
    model.LivingDB.create(resultObj)
        .then(function() {
        })
        .catch(function(err) {
            console.log(err);
        });
});

livingData.pipe(parser).pipe(transformLiving);