// Load modules
var http = require('http');
var https = require('https');
var auth = require('http-auth');
var crypto = require('crypto');
var hanaSaml = require('./hana-saml');

// Grab the config file
var config;
try {
  config = require('./config');
} catch (e) {
  console.error("No config file found.");
  process.exit(1);
}

var port = config.port || 7891;
var host = config.host || 's6hanaxs.hanatrial.ondemand.com';

var basic = auth.basic({
        realm: "SAP ID Service Account"
    }, function (username, password, callback) { // Custom authentication method.
        callback(true);
    }
);

var sessionCache = {};

function getBasicAuthData(req){
  var header   = req.headers['authorization']||'',        // get the header
      token    = header.split(/\s+/).pop()||'',            // and the encoded auth token
      auth     = new Buffer(token, 'base64').toString(),    // convert from base64
      parts    = auth.split(/:/),                          // split on colon
      authData = {};
  authData.username = parts[0];
  authData.password = parts[1];
  authData.hash = crypto.createHash('sha256').update(authData.username+authData.password).digest('hex');
  return authData;
}

function request(req, proxyres, cookie){
  // console.log(req.headers);
  headers = {
    'Cookie': cookie
  };
  if(req.headers['accept'] != undefined) {
    headers['Accept'] = req.headers['accept'];
  }
  if(req.headers['content-type'] != undefined) {
    headers['Content-Type'] = req.headers['content-type'];
  }
  // console.log(headers);
  options = {
    host: host,
    port: '443',
    path: req.url,
    method: req.method,
    headers: headers
  };
  var proxyreq = https.request(options, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {
      // console.log(res.headers['content-type']);      
      proxyres.setHeader("Content-Type",  res.headers['content-type']);
      if(res.headers['expires'] != '') { 
        proxyres.setHeader("expires",  res.headers['expires']);
      }
      proxyres.statusCode = res.statusCode;
      proxyres.end(body);
    });
  });
  if(req.method == 'POST'){
    var body = '';
    req.on('data', function (data) {
        body += data;
        // Too much POST data, kill the connection!
        if (body.length > 1e6)
            req.connection.destroy();
    });
    req.on('end', function () {});
    // console.log(body);
    proxyreq.write(body);
  }
  proxyreq.end();
}

// Creating new HTTP server.
http
  .createServer(basic, function(req, res) {
    console.log(req.method + " " + req.url);
    var authData = getBasicAuthData(req);
    var samlAuthData = {};
    samlAuthData.host = host;
    samlAuthData.path = req.url;
    samlAuthData.username = authData.username;
    samlAuthData.password = authData.password;
  
    if(sessionCache[authData.hash] === undefined){
      hanaSaml.authenticate(samlAuthData, function(cookie){
        // console.log(cookie);
        sessionCache[authData.hash] = cookie;
        // res.end(sessionCache[authData.hash]);
        request(req, res, sessionCache[authData.hash]);
      });
    } else {
      request(req, res, sessionCache[authData.hash]);
    }
  })
  .listen(port, function () {
    console.log('SAP HANA Cloud Tial Authentication Proxy for HANA XS Services ready: http://localhost:' + port);
  });