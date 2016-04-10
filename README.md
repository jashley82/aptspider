# aptspider
crawl a site, copy static content into an s3 bucket, compare md5 hashes of existing and new versions of files, perform cloudfront invalidations

install dependencies
```bash
npm install
```

start app server
```bash
npm start
```

send a request
```bash
curl -d "seedurl=example.com&distid=cloudfrontdistid" localhost:3000
```
