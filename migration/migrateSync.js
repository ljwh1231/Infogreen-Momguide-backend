const fs = require("fs");
const csv = require("csv");
const model = require("../models");
const cosmeticData = fs.createReadStream('./data/dbcosmetic.csv');
const cosmeticComponentsData = fs.createReadStream('./data/cosmetic_components.csv');
const livingData = fs.createReadStream('./data/dbliving.csv');
const livingComponentsData = fs.createReadStream('./data/living_components.csv');

// 고유번호,제품명,브랜드,카테고리,조회수,총별점,별점횟수
const cosmeticArray = [];
const transformCosmetic = csv.transform(function(row) {
    cosmeticArray.push(row);
});
const createCosmetic = async (row) => {
    const index = Number(row[0]) + 1;
    if(isNaN(index)) {
        console.log("고유번호가 숫자가 아닙니다.");
        console.log(row[0]);
    }
    const name = row[1];
    const brand = row[2];
    const category = row[3];
    const viewNum = row[4] === '' ? 0 : Number(row[4]);
    if(isNaN(viewNum)) {
        console.log('조회수가 숫자가 아닙니다.');
        console.log(row[4]);
        return;
    }
    const rateSum = row[5] === '' ? 0 : Number(row[5]);
    if(isNaN(rateSum)) {
        console.log('총 별점이 숫자가 아닙니다.');
        console.log(row[5]);
        return;
    }
    const rateCount = row[6] === '' ? 0 : Number(row[6]);
    if(isNaN(rateCount)) {
        console.log('별점횟수가 숫자가 아닙니다.');
        console.log(row[6]);
        return;
    }

    let resultObj = {
        index: index,
        name: name,
        brand: brand,
        category: category,
        viewNum: viewNum,
        rateSum: rateSum,
        rateCount: rateCount
    };
    await model.CosmeticDB.create(resultObj);
};

// 고유번호,성분명(국문명),이명,영문명,CAS,배합용도,EWG등급,EWG데이터등급,EWG코드,알러지,호흡,피부,발달/생식,발암,눈,주의,비고
const cosmeticComponentsArray = [];
const transformCosmeticComponents = csv.transform(function(row) {
    cosmeticComponentsArray.push(row);
});
const createCosmeticComponents = async (row) => {
    const index = Number(row[0]);
    if(isNaN(index)) {
        console.log("고유번호가 숫자가 아닙니다.");
        console.log(row[0]);
        return;
    }
    const name = row[1];
    const diffName = row[2];
    const engName = row[3];
    const cas = row[4];
    const use = row[5];
    const ewg = row[6];
    const ewgData = row[7];
    const ewgCode = row[8];
    const allergic = row[9];
    const breath = row[10];
    const skin = row[11];
    const develop = row[12];
    const cancer = row[13];
    const eye = row[14];
    const caution = row[15];
    const remarks = row[16];

    let resultObj = {
        index: index,
        name: name,
        diffName: diffName,
        engName: engName,
        cas: cas,
        use: use,
        ewg: ewg,
        ewgData: ewgData,
        ewgCode: ewgCode,
        allergic: allergic,
        breath: breath,
        skin: skin,
        dev: develop,
        cancer: cancer,
        eye: eye,
        caution: caution,
        remarks: remarks
    };
    await model.CosmeticIngredient.create(resultObj);
};

// 고유번호, 제품이름, 브랜드, 제조사, 카테고리, 성분공개, 자가검사번호, 기타허가인증여부, 친환경인증여부, 해외인증여부, 조회수, 총별점, 별점인원
const livingArray = [];
const transformLiving = csv.transform(function(row) {
    livingArray.push(row);
});
const createLiving = async (row) => {
    const index = Number(row[0]) + 1;
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
    await model.LivingDB.create(resultObj);
};

// 고유번호,성분명(국문),영문명,CAS번호,배합용도,EWG등급,천식/호흡,피부자극,발달/생식,발암,천식/호흡,피부자극,발달/생식,발암,국내유해,D S L,EPA,SLS/SLES,4급암모늄,향료,색소/형광,가습기,비고,S or R,천식/호흡,피부자극,발달/생식,발암,눈자극
const livingComponentArray = [];
const transformLivingComponent = csv.transform(function(row) {
    livingComponentArray.push(row);
});
const createLivingComponent = async (row) => {
    const index = Number(row[0]);
    if(isNaN(index)) {
        console.log('고유번호가 숫자가 아닙니다.');
        console.log(row[0]);
        return;
    }
    const name = row[1];
    const engName = row[2];
    const cas = row[3];
    const use = row[4];
    const ewg = row[5];
    const toxicBreath = row[6];
    const toxicSkin = row[7];
    const toxicDevelop = row[8];
    const toxicCancer = row[9];
    const scoreBreath = row[10];
    const scoreSkin = row[11];
    const scoreDevelop = row[12];
    const scoreCancer = row[13];

    let harmness = row[14];
    if(harmness === '1') {
        harmness = true;
    } else if(harmness === '0') {
        harmness = false;
    } else if(harmness === '') {
        harmness = false;
    } else {
        console.log('국내유해 데이터가 잘못된 형식입니다.');
        console.log(row[14]);
        return;
    }

    let dsl = row[15];
    if(dsl === '1') {
        dsl = true;
    } else if(dsl === '0') {
        dsl = false;
    } else if(dsl === '') {
        dsl = false;
    } else {
        console.log('국내유해 데이터가 잘못된 형식입니다.');
        console.log(row[14]);
        return;
    }

    const epa = row[16];

    let slsSles = row[17];
    if(slsSles === '1') {
        slsSles = true;
    } else if(slsSles === '0') {
        slsSles = false;
    } else if(slsSles === '') {
        slsSles = false;
    } else {
        console.log('국내유해 데이터가 잘못된 형식입니다.');
        console.log(row[14]);
        return;
    }

    let ammonium = row[18];
    if(ammonium === '1') {
        ammonium = true;
    } else if(ammonium === '0') {
        ammonium = false;
    } else if(ammonium === '') {
        ammonium = false;
    } else {
        console.log('국내유해 데이터가 잘못된 형식입니다.');
        console.log(row[14]);
        return;
    }

    let scent = row[19];
    if(scent === '1') {
        scent = true;
    } else if(scent === '0') {
        scent = false;
    } else if(scent === '') {
        scent = false;
    } else {
        console.log('국내유해 데이터가 잘못된 형식입니다.');
        console.log(row[14]);
        return;
    }

    let color = row[20];
    if(color === '1') {
        color = true;
    } else if(color === '0') {
        color = false;
    } else if(color === '') {
        color = false;
    } else {
        console.log('국내유해 데이터가 잘못된 형식입니다.');
        console.log(row[14]);
        return;
    }

    let humid = row[21];
    if(humid === '1') {
        humid = true;
    } else if(humid === '0') {
        humid = false;
    } else if(humid === '') {
        humid = false;
    } else {
        console.log('국내유해 데이터가 잘못된 형식입니다.');
        console.log(row[14]);
        return;
    }

    const remark = row[22];
    const sr = row[23];
    const echaBreath = row[24];
    const echaSkin = row[25];
    const echaDevelop = row[26];
    const echaCancer = row[27];
    const echaEye = row[28];

    let resultObj = {
        index: index,
        korName: name,
        engName: engName,
        cas: cas,
        use: use,
        ewg: ewg,
        toxicBreath: toxicBreath,
        toxicSkin: toxicSkin,
        toxicDevelop: toxicDevelop,
        toxicCancer: toxicCancer,
        scoreBreath: scoreBreath,
        scoreSkin: scoreSkin,
        scoreDevelop: scoreDevelop,
        scoreCancer: scoreCancer,
        harmness: harmness,
        dsl: dsl,
        epa: epa,
        slsSles: slsSles,
        ammonium: ammonium,
        scent: scent,
        color: color,
        humid: humid,
        remark: remark,
        sr: sr,
        echaBreath: echaBreath,
        echaSkin: echaSkin,
        echaDevelop: echaDevelop,
        echaCancer: echaCancer,
        echaEye: echaEye
    };

    await model.LivingIngredient.create(resultObj);
};

cosmeticData.pipe(csv.parse({delimiter: ','})).pipe(transformCosmetic);
cosmeticData.on('end', () => {
    for(let i = 0; i < cosmeticArray.length; i++) {
        createCosmetic(cosmeticArray[i]);
    }
});

cosmeticComponentsData.pipe(csv.parse({delimiter: ','})).pipe(transformCosmeticComponents);
cosmeticComponentsData.on('end', () => {
    for(let i = 0; i < cosmeticComponentsArray.length; i++) {
        createCosmeticComponents(cosmeticComponentsArray[i]);
    }
});

livingData.pipe(csv.parse({delimiter: ','})).pipe(transformLiving);
livingData.on('end', () => {
    for(let i = 0; i < livingArray.length; i++) {
        createLiving(livingArray[i]);
    }
});

livingComponentsData.pipe(csv.parse({delimiter: ','})).pipe(transformLivingComponent);
livingComponentsData.on('end', () => {
    for(let i = 0; i < livingComponentArray.length; i++) {
        createLivingComponent(livingComponentArray[i]);
    }
});
