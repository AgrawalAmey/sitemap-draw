var request = require('request');
var cheerio = require('cheerio');
var URL = require('url-parse');
var fs = require("fs");

function Spyder(options){
	this.MAX_DEPTH = (options && options.max_depth) || 2;
	this.startUrl = (options && options.startUrl) || "http://reachtarunhere.github.io/";
	this.visitAbsoluteLinks = (options && options.visitAbsoluteLinks) || false;
	this.pagesToVisit = [];
	this.pagesVisited = {};
	this.count = 0;
	// Creating object of start url
	this.startUrl = this.getObject(this.startUrl);

	// Base URL
	this.baseUrl = this.startUrl.data.url.protocol + "//" + this.startUrl.data.url.hostname;
}

Spyder.prototype.start = function(){
	// Start crawling 
	this.pagesToVisit.push(this.startUrl);
	this.crawl();
}

Spyder.prototype.writeJSON = function(){
	fs.writeFile('./sitemap.json', JSON.stringify(this.startUrl), 'utf-8');
}

Spyder.prototype.getObject = function(url){
	var page = new Object();
	page.id = this.count;
	this.count++;
	page.data = {}
	page.data.url = new URL(url);
	page.data.title = null;
	page.children = [];
	page.data.depth = 0;
	return page;
}

Spyder.prototype.crawl =  function() {	
  var nextPage = this.pagesToVisit.pop();

  if (nextPage == undefined){
  	this.writeJSON();
  	return;
  }

  if (nextPage.data.url.href in this.pagesVisited) {
    // We've already visited this page, so repeat the crawl
    this.crawl();
  } else {
    // New page we haven't visited
    this.visitPage(nextPage);
  }
}

Spyder.prototype.visitPage = function(page) {
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
}

Spyder.prototype.collectLinks =  function($, parentPage, callback) {
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
	    console.log("Found " + absoluteLinks.length + " relative links on page");
	  	absoluteLinks.each(function() {
	    	var page = self.getObject($(this).attr('href'));
        if (page.data.url.href in self.pagesVisited) {
          // We've already visited this page, so skip
          return;
        }
	    	page.data.depth = parentPage.data.depth + 1;
	    	parentPage.children.push(page);
	      self.pagesToVisit.push(page);
	  	});  	
    }
}

spyder = new Spyder();
spyder.start(); 

// Refresh every 6 Hrs
setInterval(function(){
  spyder = new Spyder();
  spyder.start(); 
}, 21600000);
