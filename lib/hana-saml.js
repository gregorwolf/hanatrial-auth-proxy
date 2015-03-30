

module.exports.authenticate = function (authOptions, callback) {

  // In the first version of this module,
  // the callback function only took one parameter
  // which was the cookie. However, the first parameter 
  // should always be a potential error.
  // To remain backwards-compatible, we check for the number
  // of arguments of the callback and if there's only one,
  // then it's probably still the old syntax and we just wrap it
  if (callback.length === 1) {
    // callback has only 1 argument, wrap it
    var origCallback = callback;
    callback = function(error, cookie) {
      if (error) {
        throw error
      } else {
        origCallback(cookie);
      }
    }
  }

  function createOptions(authOptions, url) {
    var options;  
    if(authOptions.proxy) {
      options = {
        url: url,
        proxy: authOptions.proxy
      };  
    } else {
      options = {
        url: url
      };  
    }

    return options;
  }

  var request = require('request');
  request.defaults({jar: true});
  var cheerio = require('cheerio');
  var qs = require('querystring');

  var url = 'https://' + authOptions.host + ':' + authOptions.path;

  var options = createOptions(authOptions, url);
  options.followRedirect = false;
  
  var cookieHana;

  // Request the XSOData Service
  // console.log(options);
  var req = request.get(options, function (error, res, resbody) {
    if (error) {
      return callback(error);
    } else if (res.statusCode >= 400) {
      return callback('Something went wrong: ' + url + ' returned ' + res.statusCode);
    }
    // console.log(res);
    var cookieHana = res.headers['set-cookie'];
    var location = res.headers.location;
    var options = createOptions(authOptions, location);
    var req2 = request.get(options, function (error, res, resbody) {
      if (error) {
        return callback(error);
      }
      var cookieAccounts = res.headers['set-cookie'];
      $ = cheerio.load(resbody);
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
      var url = res.request.uri.protocol + '//' + res.request.uri.hostname + ':' + res.request.uri.port + action;
      options = createOptions(authOptions, url);
      options.form = post;
      var headers = {
        'Cookie': cookieAccounts
      };
      options.headers = headers;
      // console.log(options);
      // Set up the request
      var post_req = request.post(options, function (error, res, resbody) {
        if (error) {
          return callback(error);
        }
        cookieAccounts = res.headers['set-cookie'];
        // console.log(cookieAccounts);
        // console.log(res);
        // Now we call the initial site
        // console.log(resbody);
        $ = cheerio.load(resbody);
        // Check if authentication failed
        var messages = $('#globalMessages').text();
        if(messages != '') {
          // console.log(messages);
          cookieHana = undefined;
          callback(null, cookieHana);
        } else {
          // Read the Form Action + Method
          action = $('form').attr('action');
          inputFields = $('input');
          i = 0;
          post = {};
          value = '';
          while (inputFields[i]) {
            post[inputFields[i].attribs.name] = inputFields[i].attribs.value;
            i++;
          }
          options = createOptions(authOptions, action);
          options.form = post;
          var headers = {
            'Cookie': cookieHana
          };
          options.headers = headers;        
          // console.log(options);        
          var post_req2 = request.post(options, function (error, res, resbody) {
            if (error) {
              return callback(error);
            }
            // console.log(res);
            cookieHana = res.headers['set-cookie'];
            // console.log(cookieHana);
            callback(null, cookieHana);
          });
          post_req2.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            callback(e);
          });
        }
      });
      post_req.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        callback(e);
      });
    });
    req2.on('error', function(e) {
      console.log('problem with request: ' + e.message);
      callback(e);
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    callback(e);
  });
}
