# Sitemap-draw
A tool to generate sitemap and make a interactive visualization.
### Installation 
```
npm install
```
### Start crawler 
```
npm start
```
### Options
Spyder takes an options object, as shown bellow.
```javascript
var spyder = new Spyder({
    "maxDepth" : 5,
    "startUrl" : "http://www.example.com",
    "visitAbsoluteLinks" : true,
    "startServer" : true
});
```
###### Default Values
By default the values are as follows:

`maxDepth :` 2

`startUrl :` "http://karpathy.github.io/"

`visitAbsoluteLinks :` `false`

`startServer :` `false`
