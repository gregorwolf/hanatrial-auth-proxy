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
        uri: url,
        proxy: authOptions.proxy
      };  
    } else {
      options = {
        uri: url
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

  // Request the page from the Service Provider
  // console.log(options);
  var req = request.get(options, function (error, res, resbody) {
    if (error) {
      return callback(error);
    } else if (res.statusCode >= 400) {
      return callback('Something went wrong: ' + url + ' returned ' + res.statusCode);
    }
    // console.log(resbody);
    var cookieHana = res.headers['set-cookie'];
    $ = cheerio.load(resbody);
    var action = $('form').attr('action');
    var SAMLRequest = $('input[name=SAMLRequest]')[0].attribs.value;
    var RelayState = $('input[name=RelayState]')[0].attribs.value;
    // console.log(RelayState);
    var post = {};
    post['SAMLRequest'] = SAMLRequest;
    post['RelayState'] = RelayState;
    var options = createOptions(authOptions, action);
    options.form = post;
    console.log(options.uri);
    // Send a POST to the Identity Provider
    var post_idp = request.get(options, function (error, res, resbody) {
      if (error) {
        return callback(error);
      } else if (res.statusCode >= 400) {
        // console.log(resbody);
        // Sorry, but we’re having trouble signing you in.
        // We received a bad request.
        // AADSTS750054: SAMLRequest or SAMLResponse must be present as query string parameters in 
        // HTTP request for SAML Redirect binding.
        return callback('Something went wrong: ' + res.request.href 
          + ' returned ' + res.statusCode + " " + res.statusMessage);
      }
      var cookiesFromIdP = res.headers['set-cookie'];
      // console.log("cookiesFromIdP: " + JSON.stringify(cookiesFromIdP));
      // console.log(res.headers);
      cheerio.load(resbody);
      $ = cheerio.load(resbody);
      // Read the loaded Javascript
      var script = $('script')[0].children[0].data;
      var config = eval(script);
      // console.log(config);
      var action = config.urlPost;
      // Fill the input fields with their values
      var post = {
        "username":authOptions.username,
        "isOtherIdpSupported":true,
        "checkPhones":false,
        "isRemoteNGCSupported":true,
        "isCookieBannerShown":false,
        "isFidoSupported":false,
        "forceotclogin":false,
        "flowToken":config.sFT
      };
      // "originalRequest":"--",
      // post['passwd'] = authOptions.password;
      // console.log(post);
      // var url = res.request.uri.protocol + '//' + res.request.uri.hostname + ':' + res.request.uri.port + action;
      var url = config.urlGetCredentialType;
      options = createOptions(authOptions, url);
      options.form = JSON.stringify(post);
      var headers = {
        "Cookie": cookiesFromIdP,
        "Accept": "application/json",
        "canary": config.apiCanary,
        "client-request-id": config.correlationId,
        "Content-type": "application/json; charset=UTF-8",
        "hpgact": config.hpgact,
        "hpgid": config.hpgid,
        "hpgrequestid": config.sessionId
      };
      options.headers = headers;
      console.log(options.uri);
      // JSON Call to urlGetCredentialType Endpoint with Username
      var post_user = request.post(options, function (error, res, resbody) {
        if (error) {
          return callback(error);
        } else if (res.statusCode >= 400) {
          // console.log(resbody);
          return callback('Something went wrong: ' + res.request.href 
            + ' returned ' + res.statusCode + " " + res.statusMessage);
        }
        getCredentialTypeCookies = res.headers['set-cookie'];
        // console.log("getCredentialTypeCookies: " + JSON.stringify(getCredentialTypeCookies));
        // console.log(res);
        var getCredentialType = JSON.parse(resbody);
        // console.log(getCredentialType);
        var url = res.request.uri.protocol + '//' + res.request.uri.hostname + ':' + res.request.uri.port + config.urlPost;
        options = createOptions(authOptions, url);
        // console.log("cookiesFromIdP: " + JSON.stringify(cookiesFromIdP));
        /*
        // Missing Cookies:
        CkTst	G1551977917965
        MSCC	1551977922
        wlidperf	FR=L&ST=1551977927446
        */
        var headers = {
          "Cookie": cookiesFromIdP,
          "Content-Type": "application/x-www-form-urlencoded"
        };
        options.headers = headers;
        var post = {
          "login": getCredentialType.Username,
          "loginfmt": getCredentialType.Username,
          "type": 11,
          "LoginOptions": 3,
          "passwd": authOptions.password,
          "ps": 2,
          "canary": config.canary,
          "ctx": config.sCtx,
          "hpgrequestid": config.sessionId,
          "flowToken": getCredentialType.FlowToken,
          "NewUser": 1,
          "fspost": 0,
          "i21": 0,
          "CookieDisclosure": 0,
          "IsFidoSupported": 1
        };
        /*
          "i13": 0,
          "i2": 102,
          "i19": 26519
        */
        options.form = post;
        console.log(options.uri);
        var post_password = request.post(options, function (error, res, resbody) {
          if (error) {
            return callback(error);
          } else if (res.statusCode >= 400) {
            // console.log(resbody);
            return callback('Something went wrong: ' + res.request.href 
              + ' returned ' + res.statusCode + " " + res.statusMessage);
          }
          getPasswordCookies = res.headers['set-cookie'];
          // console.log("getPasswordCookies: " + getPasswordCookies);
          // console.log(res);
          // console.log(resbody);
          $ = cheerio.load(resbody);
          var script = $('script')[0].children[0].data;
          var configPassword = eval(script);
          // console.log(JSON.stringify(configPassword));
          // console.log(getCredentialType);
          var url = res.request.uri.protocol + '//' + res.request.uri.hostname + ':' + res.request.uri.port + '/kmsi';
          options = createOptions(authOptions, url);
          var headers = {
            "Cookie": getPasswordCookies,
            "Content-Type": "application/x-www-form-urlencoded"
          };
          options.headers = headers;
          var post = {
            "LoginOptions": 0,
            "ctx": config.sCtx,
            "hpgrequestid": config.sessionId,
            "flowToken": getCredentialType.FlowToken,
            "canary": config.canary,
            "DontShowAgain": true,
            "i2": "",
            "i17": "",
            "i18": "",
            "i19": 15893
          };
          options.form = post;
          console.log(options.uri);
          var post_dontsave = request.post(options, function (error, res, resbody) {
            if (error) {
              return callback(error);
            } else if (res.statusCode >= 400) {
              // console.log(resbody);
              return callback('Something went wrong: ' + res.request.href 
                + ' returned ' + res.statusCode + " " + res.statusMessage);
            }
            getPasswordCookies = res.headers['set-cookie'];
            // console.log("getPasswordCookies: " + getPasswordCookies);
            // console.log(resbody);
            $ = cheerio.load(resbody);
            var script = $('script')[0].children[0].data;
            var configKMSI = eval(script);
            console.log(JSON.stringify(configKMSI));
            /*
            // Now we call the initial site

            // console.log(resbody);
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
              console.log(options);
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
            */
          });
          post_dontsave.on('error', function(e) {
            console.log('problem with request: ' + e.message);
            callback(e);
          });
        });
        post_password.on('error', function(e) {
          console.log('problem with request: ' + e.message);
          callback(e);
        });
      });
      post_user.on('error', function(e) {
        console.log('problem with request: ' + e.message);
        callback(e);
      });
    });
    post_idp.on('error', function(e) {
      console.log('problem with request: ' + e.message);
      callback(e);
    });
  });
  req.on('error', function(e) {
    console.log('problem with request: ' + e.message);
    callback(e);
  });
}
