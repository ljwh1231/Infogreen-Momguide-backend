const fs = require("fs");
const csv = require("csv");
const model = require("../models");
const cosmeticAndComponentData = fs.createReadStream('./data/cosmetic_and_component.csv');
const livingAndComponentData = fs.createReadStream('./data/living_and_component.csv');

// Migrate many to many data
const nowDate = new Date();
const timeString = nowDate.getFullYear() + '-' + ('0' + (nowDate.getMonth() + 1)).slice(-2) + '-' + nowDate.getDate() + ' ' + ('0' + nowDate.getHours()).slice(-2) + ':' + ('0' + nowDate.getMinutes()).slice(-2) + ':' + ('0' + nowDate.getSeconds()).slice(-2);

const cosmeticAndComponentDataArray = [];
const transformCosmeticAndComponentData = csv.transform(function(row) {
    cosmeticAndComponentDataArray.push(row);
});
const createCosmeticAndComponent = async (row) => {
    const productIndex = Number(row[0]) + 1;
    if(isNaN(productIndex)) {
        console.log('cosmetic index가 숫자가 아닙니다.');
        console.log(row[0]);
        return;
    }
    const ingredientIndex = Number(row[1]);
    if(isNaN(ingredientIndex)) {
        console.log('cosmetic ingredient index가 숫자가 아닙니다.');
        console.log(row[1]);
        return;
    }
    let query = `INSERT INTO cosmetic_ingredient_to_product(created_at, updated_at, cosmetic_ingredient_index, cosmetic_index) VALUES('${timeString}', '${timeString}',${ingredientIndex}, ${productIndex})`;
    await model.sequelize.query(query)
};

const livingAndComponentDataArray = [];
const transformLivingAndComponentData = csv.transform(function(row) {
    livingAndComponentDataArray.push(row);
});
const createLivingAndComponentData = async (row) => {
    const productIndex = Number(row[0]) + 1;
    if(isNaN(productIndex)) {
        console.log('living index가 숫자가 아닙니다.');
        console.log(row[0]);
        return;
    }
    const ingredientIndex = Number(row[1]);
    if(isNaN(ingredientIndex)) {
        console.log('living ingredient index가 숫자가 아닙니다.');
        console.log(row[1]);
        return;
    }
    let query = `INSERT INTO living_ingredient_to_product(created_at, updated_at, living_ingredient_index, living_index) VALUES('${timeString}', '${timeString}',${ingredientIndex}, ${productIndex})`;
    await model.sequelize.query(query);
};

cosmeticAndComponentData.pipe(csv.parse({delimiter: ','})).pipe(transformCosmeticAndComponentData);
cosmeticAndComponentData.on('end', () => {
    for(let i = 0; i < cosmeticAndComponentDataArray.length; i++) {
        createCosmeticAndComponent(cosmeticAndComponentDataArray[i]);
    }
});

livingAndComponentData.pipe(csv.parse({delimiter: ','})).pipe(transformLivingAndComponentData);
livingAndComponentData.on('end', () => {
    for(let i = 0; i < livingAndComponentDataArray.length; i++) {
        createLivingAndComponentData(livingAndComponentDataArray[i]);
    }
});
