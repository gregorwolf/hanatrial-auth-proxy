// Load modules
var http = require('http');
var auth = require('http-auth');

// Grab the config file
var config;
try {
  config = require('./config');
} catch (e) {
  console.error("No config file found.");
  process.exit(1);
}

var port = config.port || 7891;

var basic = auth.basic({
        realm: "SAP ID Service Account"
    }, function (username, password, callback) { // Custom authentication method.
        callback(true);
    }
);

// Creating new HTTP server.
http
  .createServer(basic, function(req, res) {
    var header=req.headers['authorization']||'',        // get the header
        token=header.split(/\s+/).pop()||'',            // and the encoded auth token
        auth=new Buffer(token, 'base64').toString(),    // convert from base64
        parts=auth.split(/:/),                          // split on colon
        username=parts[0],
        password=parts[1];

    res.writeHead(200,{'Content-Type':'text/plain'});
    res.end('username is "'+username+'" and password is "'+password+'"');
  })
  .listen(port, function () {
    console.log('SAP HANA Cloud Tial Authentication Proxy for HANA XS Services ready: http://localhost:' + port);
  });