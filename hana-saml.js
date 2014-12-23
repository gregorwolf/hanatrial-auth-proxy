exports.authenticate = function (authOptions, callback) {
  var https = require('https');
  var cheerio = require('cheerio');
  var qs = require('querystring');

  var options = {
    host: authOptions.host,
    port: 443,
    path: authOptions.path,
    method: 'GET'
  };
  // console.log(options);
  
  var cookieHana;

  // Request the XSOData Service
  var req = https.request(options, function(res) {    
    res.on('data', function(d) {
    });
    var location = res.headers.location;
    cookieHana = res.headers['set-cookie'];
    res.on('end', function() {
      // If we're not yet authenticated we will be redirected by location
      if(location != '') {
        // console.log(location);
        // Build new request options
        var fields = location.split('//');
        fields = fields[1].split(':');
        var host = fields[0];
        var port = fields[1].substr(0,fields[1].indexOf('/'));
        var path = fields[1].substr(fields[1].indexOf('/'));
        options = {
          host: host,
          port: port,
          path: path,
          method: 'GET'
        };

        var req2 = https.request(options, function(res) {
          // console.log(res.statusCode);
          var cookieAccounts = res.headers['set-cookie'];
          // console.log(cookieAccounts);
          // Now we get an HTML Form
          var body = '';
          res.on('data', function(chunk) {
            body += chunk;
          });
          res.on('end', function() {
            $ = cheerio.load(body);
            // Read the Form Action + Method
            var action = $('form').attr('action');
            // Read the input fields with their values
            var inputFields = $('input');
            var i = 0;
            var post = {};
            var value = '';
            while (inputFields[i]) {          
              switch(inputFields[i].attribs.name) {
                case 'j_username':
                  value = authOptions.username;
                  break;
                case 'j_password':
                  value = authOptions.password;              
                  break;
                default:
                   value = inputFields[i].attribs.value;          
                  break;
              }
              post[inputFields[i].attribs.name] = value;
              i++;
            }
            // console.log(post);        
            var postData = qs.stringify(post);
            // console.log(postData);        
            var contentLength = Buffer.byteLength(postData);
            // console.log(contentLength);        
            var headers = {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Content-Length': contentLength,
              'Cookie': cookieAccounts
            };
            options = {
              host: host,
              port: port,
              path: action,
              method: 'POST',
              headers: headers
            };
            // console.log(options);        
            // Set up the request
            var post_req = https.request(options, function(res) {
              res.setEncoding('utf8');
              cookieAccounts = res.headers['set-cookie'];
              body = '';
              res.on('data', function (chunk) {
                body += chunk;
              });
              res.on('end', function() {
                // Now we call the initial site
                $ = cheerio.load(body);
                // Read the Form Action + Method
                action = $('form').attr('action');
                // Build new request options
                fields = action.split('//');
                // console.log(fields);
                host = fields[1].substr(0,fields[1].indexOf('/'));
                path = fields[1].substr(fields[1].indexOf('/'));
                // Read the input fields with their values
                inputFields = $('input');
                i = 0;
                post = {};
                value = '';
                while (inputFields[i]) {
                  post[inputFields[i].attribs.name] = inputFields[i].attribs.value;
                  i++;
                }
                // console.log(post);        
                postData = qs.stringify(post);
                // console.log(postData);        
                contentLength = Buffer.byteLength(postData);
                // console.log(contentLength);        
                headers = {
                  'Content-Type': 'application/x-www-form-urlencoded',
                  'Content-Length': contentLength,
                  'Cookie': cookieHana
                };
                options = {
                  host: host,
                  port: port,
                  path: path,
                  method: 'POST',
                  headers: headers
                };
                // console.log(options);
                var post_req2 = https.request(options, function(res) {
                  // console.log(res.statusCode);
                  cookieHana = res.headers['set-cookie'];
                  body = '';
                  res.on('data', function (chunk) {
                    body += chunk;
                  });
                  res.on('end', function() {
                    // console.log(cookieHana);
                    callback(cookieHana);
                  });
                });
                post_req2.write(postData);
                post_req2.end();
              });
            });
            // post the data
            post_req.write(postData);
            post_req.end();
          });
        });
        req2.end();
      }
    });
  });
  req.end();
}
