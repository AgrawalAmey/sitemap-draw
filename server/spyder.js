var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require("fs");
var http = require('http');
var path = require('path');
var open = require('open');

function Spyder(options){
	this.MAX_DEPTH = (options && options.maxDepth) || 2;
	this.startUrl = (options && options.startUrl) || "http://karpathy.github.io/";
	this.visitAbsoluteLinks = (options && options.visitAbsoluteLinks) || true;
	this.pagesToVisit = [];
	this.pagesVisited = {};
	this.count = 0;
  // Get pages in last visit
  this.pagesLastVisited = JSON.parse(fs.readFileSync(path.join(__dirname, '../server/visitedPages.json'), 'utf8'));
	// Creating object of start url
	this.startUrl = this.getObject(this.startUrl);
  this.startServer = (options && options.startServer) || false;

	// Base URL
	this.baseUrl = this.startUrl.data.url.protocol + "//" + this.startUrl.data.url.hostname;
}

Spyder.prototype = {
  start : function(){
    // Start crawling 
    this.pagesToVisit.push(this.startUrl);
    this.crawl();
  },
  //write files at the end of crawl
  writeJSON : function(){
    fs.writeFile(path.join(__dirname, '../server/visitedPages.json'), JSON.stringify(this.pagesVisited), 'utf-8');
    fs.writeFile(path.join(__dirname, '../client/sitemap.json'), JSON.stringify(this.startUrl), 'utf-8');
  },
  //Create default object for page
  getObject : function(url){
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
  crawl : function() {  
    var nextPage = this.pagesToVisit.pop();
    
    // End of crawl
    if (nextPage == undefined){
      //Write JONS and start server
      this.writeJSON();
      if(this.startServer == true)
        startHTTPServer();
        open('http://localhost:8000');
      return;
    }
  
    if (nextPage.data.url.href in this.pagesVisited) {
      // We've already visited this page, so repeat the crawl
      this.crawl();
    } else {
      // New page we haven't visited
      //Check if the page was present in last crawl if yes mark isNew to false.
      if(nextPage.data.url.href in this.pagesLastVisited){
        nextPage.data.isNew = fasle;
      }
      this.visitPage(nextPage);
    }
  },
  visitPage : function(page) {
    var self = this;
    // Max depth condition
    if(page.data.depth > this.MAX_DEPTH) {
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
      page.data.title = String(page.data.title).replace('\t','');
      page.data.title = String(page.data.title).replace('\r','');
      page.data.title = String(page.data.title).replace('\n','');
  
      self.collectLinks($, page);
      self.crawl();
    });
  },
  collectLinks : function($, parentPage, callback) {
    var self = this;

    var relativeLinks = $("a[href^='/']");
    console.log("Found " + relativeLinks.length + " relative links on page");
    relativeLinks.each(function() {
      var page = self.getObject(self.baseUrl + $(this).attr('href'));
      if (page.data.url.href in self.pagesVisited) {
        // We've already visited this page, so skip
        return;
      }
      page.data.depth = parentPage.data.depth + 1;
      parentPage.children.push(page);
      self.pagesToVisit.push(page);
    });

    if(this.visitAbsoluteLinks){
      var absoluteLinks = $("a[href^='http']");
      console.log("Found " + absoluteLinks.length + " absolute links on page");
      absoluteLinks.each(function() {
        var page = self.getObject($(this).attr('href'));
        if (page.data.url.href in self.pagesVisited || page.data.url.hostname != self.startUrl.data.url.hostname) {
          // We've already visited this page, so skip
          return;
        }
        page.data.depth = parentPage.data.depth + 1;
        parentPage.children.push(page);
        self.pagesToVisit.push(page);
      });   
    }
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
    
  }).listen(8000);
  console.log('Server running at http://127.0.0.1:8000/'); 
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
