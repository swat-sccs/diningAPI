# SCCS Dining API

Basically serves dining option data for campus options but contains custom
JSON data structures for ease of data customization. Hosted, daemonized, 
and served off Tern/Dodo using Linux's PM2 as a Node Express app.



## Start Service:
pm2 start index.js --watch

<pm2 start index.js> means that we will start the program, index.js, using pm2,
or the (node) package manager 2.
<--watch> means that pm2 will auto-restart the process when index.js is changed



## Restart Service after editing index.js:
pm2 restart <id>

where <id> is the id of the running program (index.js). 


## View running processes and their IDs:
pm2 ps



## View crash causes:
pm2 logs


After it successfully reloads, you're good to go. Simply nagivate to 
http://dining.sccs.swarthmore.edu/api to see the output. We recommend 
using a JSON formatter browser extension to make it more readable like
this: https://tinyurl.com/y68w29py .




## Endpoints:
 - /        | None
 - /data    | Original data provided from dash.swarthmore.edu/dining_json
 - /api     | Custom formatted data using index.js



## MIGRATION TO A NEW SERVER
To migrate this API to a new server, copy all the files over as usual.

Edit the DNS listing under /etc/binds/sccs.db, or where ever this file is. Check
the Gitbook for more details. Freeze, bind, and thaw to change the DNS.

Copy over the diningAPI.conf file from the previous server to new one, under
/etc/apache2/sites-available/ . Run sudo a2ensite diningAPI.conf to enable the
API. Run sudo systemctl reload apache2 to recognize changes.

Download and install PM2 if not already installed. Start service and ensure
the API is running by typing [pm2 ls]. Once verified that it is running, run 
[pm2 startup]. This will print a command in the terminal, of which you will
run. Once these two commands have been run, run [pm2 save] to save the current 
process list. This ensures that the processes currently listed will auto
start after a server reboot/crash/etc. Run [pm2 resurrect] to check that the 
process is still running.