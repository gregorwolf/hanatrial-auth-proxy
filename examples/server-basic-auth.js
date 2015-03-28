// Load modules
var http = require('http');
var https = require('https');
var fs = require('fs');
var crypto = require('crypto');
var hanaSaml = require('./../lib/hana-saml');
var request = require('request');

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
var httpsServer = config.https || false;
var proxyServer = config.proxy || '';
var httpsOptions = {};
if(httpsServer) {
  httpsOptions = {
    key: fs.readFileSync(config.key),
    cert: fs.readFileSync(config.cert)
  };
}

var timeout = config.timeout || 1800;
var timestampTimeout;
// Calculate timeout in miliseconds
timeout = timeout * 1000;

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

function proxyRequest(proxyreq, proxyres, cookie){
  // console.log(proxyreq.headers);
  headers = {
    'Cookie': cookie
  };
  if(proxyreq.headers['accept'] != undefined) {
    headers['Accept'] = proxyreq.headers['accept'];
  }
  if(proxyreq.headers['content-type'] != undefined) {
    headers['Content-Type'] = proxyreq.headers['content-type'];
  }
  // console.log(headers);
  var url = 'https://' + host + ':443' + proxyreq.url;
  options = {
    url: url,
    method: proxyreq.method,
    headers: headers,
    proxy: proxyServer
  };
  var body = '';
  proxyreq.on('data', function (data) {
      body += data;
      // Too much POST data, kill the connection!
      if (body.length > 1e6)
          proxyreq.connection.destroy();
  });
  proxyreq.on('end', function () {
    if(proxyreq.method == 'POST' || proxyreq.method == 'PUT'){
      options.body = body;
    }
    // request.debug = true;
    // console.log('Original Request body: ' + body);    
    var req = request(options, function (error, res, body) {
      // console.log('Proxy Response body: ' + body);      
      proxyres.setHeader("Content-Type",  res.headers['content-type']);
      if(res.headers['expires'] != '') { 
        proxyres.setHeader("expires",  res.headers['expires']);
      }
      proxyres.statusCode = res.statusCode;
      proxyres.end(body);
    });
    req.on('error', function(e) {
      console.log('problem with request: ' + e.message);
    });
  });  
}

var proxy = function (req, res) {
  var auth = req.headers['authorization']; // auth is in base64(username:password) so we need to decode the base64

  if(!auth) { 
    res.statusCode = 401;
    res.setHeader('WWW-Authenticate', 'Basic realm="SAP ID Service Account"');
    res.end('<html><body>Provide your SAP ID Service Account username and password</body></html>');
  }

  else if(auth) { // The Authorization was passed in so now we validate it  
    console.log(req.method + " " + req.url);
    var authData = getBasicAuthData(req);
    var samlAuthData = {};
    samlAuthData.host = host;
    samlAuthData.path = req.url;
    samlAuthData.username = authData.username;
    samlAuthData.password = authData.password;
    samlAuthData.proxy = proxyServer;
    timestampTimeout = Date.now() - timeout;

    if(sessionCache[authData.hash] === undefined 
       || sessionCache[authData.hash].timestamp <= timestampTimeout){
      console.log('Get new session cookie');
      hanaSaml.authenticate(samlAuthData, function(cookie){
        // console.log(cookie);
        if(cookie === undefined){
          res.end('Authentication failed.');
        } else {
          sessionCache[authData.hash] = { 
              cookie: cookie,
              timestamp: Date.now()
          };
          // res.end(sessionCache[authData.hash]);
          proxyRequest(req, res, sessionCache[authData.hash].cookie);
        }
      });
    } else {
      proxyRequest(req, res, sessionCache[authData.hash].cookie);
    }
  }
}


// Creating new HTTP server.
if(httpsServer) {
  https
    .createServer(httpsOptions, proxy)
    .listen(port, function () {
      console.log('SAP HANA Cloud Trial Authentication Proxy for HANA XS Services ready: https://localhost:' + port);
    });
} else {
  http
    .createServer(proxy)
    .listen(port, function () {
      console.log('SAP HANA Cloud Trial Authentication Proxy for HANA XS Services ready: http://localhost:' + port);
    });  
}
