const fs = require("fs");
const csv = require("csv");
const model = require("./models");

const cosmetic_data = fs.createReadStream('./data/dbcosmetic.csv');
const cosmetic_ingredient_data = fs.createReadStream('./data/cosmetic_components.csv');
const living_data = fs.createReadStream('./data/dbliving.csv');
const living_components = fs.createReadStream('./data/living_components.csv');

const parser = csv.parse({
    delimiter: ',',
    columns: true
});

let transform_cosmetic = csv.transform(function(row) {
    let resultObj = {
        index: row['고유번호'],
        name: row['제품명'],
        brand: row['브랜드'],
        category: row['카테고리'],
        view_num: row['조회수'],
        rate_count: row['별점횟수'],
        rate_sum: row['총별점']
    }
    model.CosmeticDB.create(resultObj)
                        .then(function() {
                            console.log("record created");
                        })
                        .catch(function(err) {
                            console.log(err);
                        })
})
cosmetic_data.pipe(parser).pipe(transform_cosmetic);