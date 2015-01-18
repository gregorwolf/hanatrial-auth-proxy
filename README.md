SAP HANA Cloud Trial Authentication Proxy for HANA XS Services
==============================================================

Due to the lack of SAML support for HTTP Destinations the only way to use HANA XS resources is through a proxy server. I try to implent it in node.js with inspirations from https://github.com/leftlogic/twitter-proxy.

Concept
-------

Provide a HTTP proxy that offers basic authentication to it's clients. The basic authentication information is taken and used to do a SAML authentication against the SAP ID Service. After a sucessful authentication the session cookies are cached in comination with the basic authentication information. The cache avoids a re-authentication for further requests.

Setup
-----

* Install node.js from http://nodejs.org/
* Install the node.js modules http-auth, cheerio and querystring using npm install
* Clone this repository
* Start the proxy server using 'node server-basic-auth.js'
* Install the SAP Cloud Connector and configure to secure the connection from the HANA Cloud Platform to you local proxy server

Status
------

* 2015-01-18: Added support for HTTPS and session timeouts
* 2014-12-26: Support for HTTP GET, POST, PUT and DELETE. Tested with an SAPUI5 CRUD Applicaiton.
* 2014-12-23: There is a first working version!

### hana-saml.js

Does the heavy lifting to authenticate to the SAP ID Service and returns the session cookie for the HANA host. 

It tries to call an SAML protected HANA XS service. The client stores the Cookies set by this site for further use. Without authentication the client is first forwarded to the SAP ID Service (https://accounts.sap.com/) where a HTML form is used for the login. Also this site sets some cookies which are neded for the following request. The HTML page is scraped and all input fields are taken with it's values. The input field for username and password are filled with the command line parameters. Then the page is submitted using an HTTP POST. The call includes the cookies stored before. A sucessful authentication results in another HTML page that contains hidden input fields with the SAML Authentication response that must be SAML endpoint of the HANA XS Engine (https://s6hanaxs.hanatrial.ondemand.com/sap/hana/xs/saml/login.xscfunc). To this request the Cookies saved from the initial call must be added.

### saml-client.js

Demonstrate a node.js HTTP client that takes the command line parameters <username> and <password>. It uses hana-saml.js to get an authenticated session cookie. Then the original HANA XS Service can be called with an authenticated user. The returned data is written to the console log.

### server-basic-auth.js

Demonstrates a simple HTTP Server that requires basic authentication. It uses hana-saml.js to get an authenticated session cookie. Then the original HANA XS Service can be called with an authenticated user. Then the original HANA XS Service can be called with an authenticated user. The returned data is sent to the requesting browser. A session cache avoids a re-authentication for further requests.

TODO
----

* Error handling when username / password is incorrect
