var express = require('express');
var router = express.Router();

var AptSpider = require('../aptspider');

router.post('/', function(req, res, next) {
    if (!req.body.uuid || !req.body.seedurl) {
        return res.json({"message": "invalid params"});
    }
    else {
        new AptSpider(
                req.body.seedurl, 
                req.body.uuid, 
                'bucet',
                req.body.distid
            ).crawl();
        res.json({
            "seedurl": req.body.seedurl, 
            "uuid": req.body.uuid, 
            "distid": req.body.distid
        });
    }
});

module.exports = router;
