"use strict";

var aws = require("aws-sdk"),
    crypto = require("crypto"),
    http = require("follow-redirects").http,
    huntsman = require("huntsman"),
    Proxy = require("./proxy"),
    url = require("url"),
    Void = require("void");

aws.config.update({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID, 
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});
aws.config.region = "us-west-2";
var s3 = new aws.S3();


var SpiderPig = function(seedurl, uuid, distid, s3bucket) {
    this.seedUrl = url.parse("http://www." + seedurl);
    this.bucketPath = uuid.slice(0,2) + "/" + uuid;
    this.s3bucket = s3bucket,
    process.env.DISTRIBUTION_ID = distid;
};


SpiderPig.prototype.crawl = function() {
    var getS3Head = function(getparams, cb) {
        s3.headObject(getparams, function(err, data) {
            if (err) return cb(err); 
            else return cb(null, data);
        });
    };


    var putS3Object = function(putparams, cb) {
        s3.putObject(putparams, function(err) {
            if (err) return cb(err);
            else return cb(null, "success");
        });
    };


    var download = function(target, cb) {
        var fileObj = {},
            data = [],
            parts = url.parse(target),
            options = {
                hostname: parts.hostname,
                path: parts.path
	    };

        if (parts.path === "/") {
            fileObj.path = "/index.html";
        }
        else if (parts.path.indexOf(".") === -1) {
            fileObj.path = parts.path + "/index.html";
        }
        else {
            fileObj.path = parts.path;
        }

        http.get(options, function(res) {
            if (res.statusCode !== 200) {
                return cb(res.statusCode + " " + fileObj.path);
            }
            fileObj.contentType = res.headers['content-type'];

            res.on("error", function(error) {
                return cb(error);
            });
            res.on("data", function(d) {
                data.push(d);
            });
            res.on("end", function() {
                fileObj.body = Buffer.concat(data);
                fileObj.md5 = crypto.createHash("md5")
                    .update(fileObj.body).digest("hex");
                return cb(null, fileObj);
            });
        });
    }.bind(this);


    var sync = function(fileObj, cb) {
        var getParams = {
            Bucket: this.s3bucket,
            Key: this.bucketPath + fileObj.path
        };

        getS3Head(getParams, function(err, data) {
            var putParams = {
                ACL: "public-read",
                Bucket: getParams.Bucket,
                Key: getParams.Key,
                Body: fileObj.body,
                ContentType: fileObj.contentType
            };

            if (err && err.code === "NotFound") {
                putS3Object(putParams, function(err) {
                    if (err) return cb(err);
                    else return cb(null, "New " + putParams.Key);
                });
            }
            else if (err) {
                return cb(err);
            }
            else if (data.ETag.split("\"")[1] !== fileObj.md5) {
                putS3Object(putParams, function(err) {
                    if (err) return cb(err);
                    else {
                        var v = new Void({
                            name : putParams.Key,
                            paths : [putParams.Key]
                        });
                        return cb(null, "Updated " + putParams.Key);
                    }
                });
            }
            else return cb(null, "Not included " + putParams.Key);
        });
    }.bind(this);







    var spider = huntsman.spider({proxy: new Proxy()}),
        domain = new RegExp(this.seedUrl.href),
        imgRegex = /(img([^>]+)src)\s?=\s?['"]([^"'#]+)/gi,
        scriptRegex = /(script([^>]+)src)\s?=\s?['"]([^"'#]+)/gi,
        styleRegex = /(link([^>]+)href)\s?=\s?['"]([^"'#]+)/gi,
        fileTypeFilter = /\.jpg|\.gif|\.png|\.css|\.js/i;

    spider.extensions = [
        //huntsman.extension("stats"),
        huntsman.extension("recurse"), 
        huntsman.extension("recurse", {
            pattern: {
                search: imgRegex, 
                filter: fileTypeFilter 
            }
        }),
        huntsman.extension("recurse", {
            pattern: {
                search: scriptRegex, 
                filter: fileTypeFilter 
            }
        }),
        huntsman.extension("recurse", {
            pattern: {
                search: styleRegex, 
                filter: fileTypeFilter 
            }
        })
    ];

    spider.on("error", console.error);

    spider.on(domain, function (err, res) {
        download(res.uri, function(err, fileObj) {
            if (err) return console.log(err);
            else {
                sync(fileObj, function(err, data) {
                    if (err) return console.log(err);
                    else return console.log(data);
                });
            }
        });
    });

    spider.queue.add(this.seedUrl.href);
    spider.start();
};

module.exports = AptSpider;
