var https = require('https');
var hanaSaml = require('./hana-saml');

// Grab the config file
var config;
try {
  config = require('./config');
} catch (e) {
  console.error("No config file found.");
  process.exit(1);
}

var args = process.argv.slice(2);
var authOptions = {};
authOptions['username'] = process.argv[2];
authOptions['password'] = process.argv[3];

// Test URL: https://s6hanaxs.hanatrial.ondemand.com/p598692trial/helloworld/sample/services/samples.xsodata/Samples
authOptions['host'] = config.host || 's6hanaxs.hanatrial.ondemand.com';
authOptions['path'] = '/p598692trial/helloworld/sample/services/samples.xsodata/Samples';

var cookieHana = hanaSaml.authenticate(authOptions, function(cookie){
  // console.log('saml-client cookieHana: ' + cookie);

  headers = {
    'Cookie': cookie
  };

  options = {
    host: authOptions.host,
    port: '443',
    path: authOptions.path,
    method: 'GET',
    headers: headers
  };

  var req = https.request(options, function(res) {
    var body = '';
    res.on('data', function(chunk) {
      body += chunk;
    });
    res.on('end', function() {     
      console.log(body);
    });
  });
  req.end();
});
