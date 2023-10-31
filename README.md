So basically this api is a Node Express API, currently running daemonized
using Linux's pm2. 

In order to see the changes that you've done to the index.js file, reload
the running process using pm2:

pm2 restart <id>

where <id> is the id of the running program (index.js). To see the list of 
running programs on pm2, run

pm2 ps

After it successfully reloads, you're good to go. Simply nagivate to 
http://dining.sccs.swarthmore.edu/api to see the output.