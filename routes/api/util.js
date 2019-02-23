const jwt = require('jsonwebtoken');
const config = require('../../config/config');

// function to get extension in filename
exports.getExtension = (fileName) =>  {
    const list = fileName.split('.');
    return '.' + list[list.length-1];
};

// function to decode user token
exports.decodeToken = (token, res) => {
    if (!token) {
        res.status(400).json({
            error: "invalid request"
        });
        return;
    }

    token = token.substring(7);

    return new Promise(
        (resolve, reject) => {
            jwt.verify(token, config.jwtSecret, (err, decoded) => {
                if(err) {
                    reject(err);
                } else {
                    resolve(decoded);
                }
            })
        }
    );
};
