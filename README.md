# SCCS Dining API

Basically serves dining option data for campus options but contains custom
JSON data structures for ease of data customization. Hosted, daemonized, 
and served off Ibis using Linux's PM2 as a Node Express app.

In order to see the changes that you've done to the index.js file, reload
the running process using pm2:

pm2 restart <id>

where <id> is the id of the running program (index.js). To see the list of 
running programs on pm2, run

pm2 ps

After it successfully reloads, you're good to go. Simply nagivate to 
http://dining.sccs.swarthmore.edu/api to see the output. We recommend 
using a JSON formatter browser extension to make it more readable like
this: https://tinyurl.com/y68w29py .

## Endpoints:
 - /        | None
 - /data    | Original data provided from dash.swarthmore.edu/dining_json
 - /api     | Custom formatted data using index.js
