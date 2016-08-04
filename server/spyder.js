/*
Copyright (c) 2016 Author. Author: Amey Agrawal (http://github.com/agrawalamey)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

 */
require('string.prototype.startswith');
var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require("fs");
var http = require('http');
var path = require('path');
var open = require('open');
var urljoin = require('url-join');

function Spyder(options){
  
  this.MAX_DEPTH = (options && options.maxDepth) || 6;
  this.startUrl = (options && options.startUrl) || "http://karpathy.github.io/";
  this.allowOtherHostname = (options && options.allowOtherHostname) || false;
  this.pagesToVisit = [];
  this.pagesVisited = {};
  this.count = 0;
  this.validPageTypes = [".jsp", ".html", ".htm", ''];
  
  // Get pages in last visit
  this.pagesLastVisited = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/visitedPages.json'), 'utf8'));
  
  // Creating object of start url
  this.startUrl = this.getObject(this.startUrl);
  this.startServer = (options && options.startServer) || false;

  // Base URL
  this.baseUrl = this.startUrl.data.url.protocol + "//" + this.startUrl.data.url.hostname;
}

Spyder.prototype = {
  
  start: function(){
    // Start crawling 
    this.pagesToVisit.push(this.startUrl);
    this.crawl();
  },
  
  //write files at the end of crawl
  writeJSON: function(){
    fs.writeFile(path.join(__dirname, '../server/visitedPages.json'), JSON.stringify(this.pagesVisited), 'utf-8');
    fs.writeFile(path.join(__dirname, '../client/sitemap.json'), JSON.stringify(this.startUrl), 'utf-8');
  },
  
  //Create default object for page
  getObject: function(url){
    var page = new Object();
    page.id = this.count;
    this.count++;
    page.data = {}
    page.data.url = new URL(url);
    page.data.title = null;
    page.data.isNew = true;
    page.children = [];
    page.data.depth = 0;
    return page;
  },
  
  crawl: function() {  
    var nextPage = this.pagesToVisit.pop();
    
    // End of crawl
    if (nextPage == undefined){
      //Write JONS and start server
      this.writeJSON();
      if(this.startServer == true){
        startHTTPServer();
        open('http://localhost:8080');
      }
      return;
    }
  
    if (nextPage.data.url.href in this.pagesVisited) {
      // We've already visited this page, so repeat the crawl
      this.crawl();
    } else {
      // New page we haven't visited
      //Check if the page was present in last crawl if yes mark isNew to false.
      if(nextPage.data.url.href in this.pagesLastVisited){
        nextPage.data.isNew = false;
      }else{
        nextPage.data.isNew = true;
      }
      this.visitPage(nextPage);
    }
  },
  
  visitPage: function(page) {
    var self = this;


    // Make the request
    // Max depth condition & valid data type
    if(page.data.depth > this.MAX_DEPTH /*|| (this.validPageTypes.indexOf(path.extname(page.data.url.href))<0)*/) {
      self.crawl();
      return;
    }

    // Add page to our set
    this.pagesVisited[page.data.url] = true;
  
    // Make the request
    console.log("Visiting page " + page.data.url);
    request(page.data.url.href, function(error, response, body) {

      if(error) {
        console.log("Error: " + error);
        self.crawl();
        return;
      }
  

      page.data.statusCode = response.statusCode;

      // Check status code (200 is HTTP OK)
      console.log("Status code: " + response.statusCode);
      if(response.statusCode !== 200) {
        self.crawl();
        return;
      }
  
      // Parse the document body 
      var $ = cheerio.load(body);
  
      // Add title
      page.data.title = $('title').text();


      self.collectRelativeLinks($, page);
      self.collectAbsoluteLinks($, page);

      self.crawl();
    });
  },
  
  collectRelativeLinks : function($, parentPage) {
    
    var self = this;
    
    // Regexp to find for non-absolute links
    var relativeLinks = $('a:not([href*="://"],[href^="#"],[href^="mailto:"])');
    
    console.log("Found " + relativeLinks.length + " relative links on page");
    
    relativeLinks.each(function() {
      //Check if a is present
      if(!$(this).attr('href')){
        return;
      }

      //Replace spaces and backslashes
      var href = $(this).attr('href').replace(/ /g,"%20");
      href = href.replace(/\\/g,"/");

      if(href in self.pagesVisited) {
        // We've already visited this page, so skip
        return;
      }
      
      // If path is given wrt hostname
      if(href.startsWith('/')){
        var page = self.getObject(urljoin(self.baseUrl, href));        
      }else{
        // If the parent-page has filename?
        if(parentPage.data.url.href.lastIndexOf('.') > parentPage.data.url.href.lastIndexOf('/')){
          var base = path.parse(parentPage.data.url.href).dir; 
        }else{
          var base = parentPage.data.url.href;
          base = base.replace(/\/$/, "");
        }
        //Spegetti for getting right static path name
        var relative = href;
        var stack = base.split("/"),
        parts = relative.split("/");

        for (var i=0; i<parts.length; i++) {
          if (parts[i] == ".")
            continue;
          if (parts[i] == "..")
            stack.pop();
          else
            stack.push(parts[i]);
        }
        var page = self.getObject(stack.join("/"));
      }

      page.data.depth = parentPage.data.depth + 1;
      parentPage.children.push(page);
      self.pagesToVisit.push(page);
    });
  },

  collectAbsoluteLinks: function($, parentPage){
    var self = this;

    var absoluteLinks = $("a[href^='http']");
    console.log("Found " + absoluteLinks.length + " absolute links on page");
    
    absoluteLinks.each(function() {
      //Replace spaces and backslashes
      var href = $(this).attr('href').replace(/ /g,"%20");
      href = href.replace(/\\/g,"/")
      
      if (href in self.pagesVisited) {
        // We've already visited this page, so skip
        return;
      }

      var page = self.getObject(href);

      //Check hostname
      if(!self.allowOtherHostname && page.data.url.hostname != self.startUrl.data.url.hostname){
        return;
      }

      page.data.depth = parentPage.data.depth + 1;
      parentPage.children.push(page);
      self.pagesToVisit.push(page);
    });   
  }
} 

function startHTTPServer(){
  // Start server
  http.createServer(function (request, response) {
      console.log('request starting...');
    
      var filePath = path.join(__dirname, '../client/') + request.url;
      if (request.url == '/')
        filePath = path.join(__dirname, '../client/index.html');
    
      var extname = path.extname(filePath);
      var contentType = 'text/html';
      switch (extname) {
          case '.js':
              contentType = 'text/javascript';
              break;
          case '.css':
              contentType = 'text/css';
              break;
          case '.json':
              contentType = 'application/json';
              break;
          case '.png':
              contentType = 'image/png';
              break;      
          case '.jpg':
              contentType = 'image/jpg';
              break;
          case '.wav':
              contentType = 'audio/wav';
              break;
      }
    
      fs.readFile(filePath, function(error, content) {
          if (error) {
              if(error.code == 'ENOENT'){
                  fs.readFile('./404.html', function(error, content) {
                      response.writeHead(200, { 'Content-Type': contentType });
                      response.end(content, 'utf-8');
                  });
              }
              else {
                  response.writeHead(500);
                  response.end('Sorry, check with the site admin for error: '+error.code+' ..\n');
                  response.end(); 
              }
          }
          else {
              response.writeHead(200, { 'Content-Type': contentType });
              response.end(content, 'utf-8');
          }
      });
    
  }).listen(8080);
  console.log('Server running at http://127.0.0.1:8080/'); 
}

// Genarate sitemap
//fs.writeFileSync(path.join(__dirname, '../server/visitedPages.json'), '{}', 'utf-8');
var spyder = new Spyder({
  "startServer" : true
});
spyder.start(); 

// Refresh every 6 Hrs
setInterval(function(){
  spyder = new Spyder();
  spyder.start(); 
}, 86400000);
