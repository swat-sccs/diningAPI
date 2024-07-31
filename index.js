const express = require('express');
const hash = require('object-hash');
const app = express();
const PORT = 8080;

app.set('trust proxy', 'loopback');


const url = 'https://dash.swarthmore.edu/dining_json';

const KBMenuRegex = /(?:Menu|order)(.+)<\/i>/gi;
const KBSoupRegex = /Soup(?:\s?)-(?:\s?)(.+?)</;

var cachedData;


// remove all <></> tags, trim whitespace, and replace double spaces with single ones 
function stripHtmlTags(s) {
    return s.replace(/<\/?[^>]+(>|$)/g, '').trim().replace(/\s{2,}/g, ' ');
}

async function Get(url) {
    const response = await fetch(url);
    const data = await response.json();
    return data;
};

function objectifier(venue, html) {
    const ret = {};
    switch (venue) {
        case 'sharples':
            // create a dummy div element to hold the HTML
            // console.log(html)
            const regex = /<span(?:.+?)>(.+?)<\/span><ul><li>(.+?)<\/li><\/ul>/gm;

            const processItems = (items) => {
                const entreeKeywords = ["chicken", "steak", "beef", "shrimp", "bacon", "sausage",
                    "pork", "pot roast", "meatball", "lamb", "turkey", "tilapia", "salmon", "wing",
                    "fried rice", "curry", "aloo gobi", "hotdog", "burger", "pizza", "vindaloo", "cod", "fish", "pollock",
                    "falafel", "catfish", "quesadilla", "pancake", "waffle", "tempeh", "tofu",
                    "seitan", "pollock", "masala", "lo mein", "chow mein", "pad thai", "pasta",
                    "mahi", "bean bake", "catfish", "risotto", "meatloaf", "pierogies"];
                return items.split(',').map(item => {
                    const properties = item.match(/::(.*?)::/g) || [];
                    return {
                        item: item.replace(/::(.*?)::/g, '').trim(),
                        properties: properties.map(prop => prop.replace(/::/g, '').replace(/ /g, '').trim())
                    }
                }).sort((a, b) => {
                    const aScore = entreeKeywords.filter(keyword => a.item.toLowerCase().includes(keyword)).length;
                    const bScore = entreeKeywords.filter(keyword => b.item.toLowerCase().includes(keyword)).length;
                    return bScore - aScore;
                });
            };

            var match;

            while ((match = regex.exec(html)) !== null) {
                const menuTitle = match[1] == 'brunch' ? 'lunch' : match[1];
                const menuItems = match[2];

                const items = processItems(menuItems);
                ret[menuTitle] = items;
            }

            return ret;
        case 'essies':
            const soupMatch = html.match(/Soup-(.*?) Today's Lunch Special/);
            const lunchMatch = html.match(/Today's Lunch Special\s+([^.]+)/);
            const mealMatch = html.match(/local food vendor will be\s+([^.]+)/);

            const ESSoup = soupMatch ? soupMatch[1] : null;
            const ESLunch = lunchMatch ? lunchMatch[1] : null;
            const ESMeal = mealMatch ? mealMatch[1] : null;

            // console.log("Essie's Soup: " + ESSoup);
            // console.log("Essie's Special: " + ESLunch);
            // console.log("Essie's Meal: " + ESMeal);

            ret['soup'] = ESSoup;
            ret['special'] = ESLunch;
            ret['meal'] = ESMeal;

            return ret;
        case 'science_center':
            ret["vendor"] = html.match(/<span>(.*?)<\/span>/)[1]
            return ret;
        case 'kohlberg':
            ret['soup'] = html.match(KBSoupRegex) ? html.match(KBSoupRegex)[1].trim() : null;;

            const menuMatch = html.match(KBMenuRegex);
            // const menuMatch = html.match(/m/);
            // console.log(menuMatch)

            if (!menuMatch) {
                console.log('No Kolhberg menu found.');
                ret['menu'] = null;
                return ret
            }

            const items = menuMatch[0].split('</p>').map(item =>
                stripHtmlTags(item
                    .trim()
                    .replace("&amp;", "&")
                    .replace(new RegExp("menu", "ig"), "")
                )
            );

            const menuItems = items.map(item => {
                // console.log(item)
                return item == '' ? {} : { item, properties: [] };
            });

            ret['menu'] = menuItems;

            return ret;

    };

};

// Crumb Project has been deprecated
// async function CrumbObject() {
//     const CrumbURL = "https://crumb.sccs.swarthmore.edu/api/cal"
//     const data = await Get(CrumbURL)

//     var reformattedData = {
//         "menu": [],
//         "specials": [],
//         "exclusions": [
//             "Avocado Toast",
//             "Berry Smoothie",
//             "Caprese",
//             "Chicken Tenders",
//             "Chips",
//             "French Toast",
//             "Fries",
//             "Hot Chocolate",
//             "Italian Soda",
//             "Loaded Quesadilla",
//             "London Fog",
//             "Matcha Latte",
//             "Milkshake",
//             "Nachos",
//             "Pancakes",
//             "Simple Quesadilla",
//             "Tea"
//         ],
//         "time": "9:00pm - 11:00pm"
//     }

//     for (let item of data) {

//         if (!item.daysOfWeek.includes(new Date().getDay()))
//             // if (!item.daysOfWeek.includes(0))
//             continue

//         let index = reformattedData.exclusions.indexOf(item.title);

//         if (index > -1) {
//             reformattedData.menu.push(item.title.trim())
//             reformattedData.exclusions.splice(index, 1)
//         } else {
//             reformattedData.specials.push(item.title.trim())
//         }
//     }


//     return reformattedData
// }


async function DiningObject() {
    return Get(url).then(async data => {
        const result = {}

        // console.log(data.dining_center[2])
        // const stripped = stripHtmlTags(data.essies[0].html_description)
        // console.log(stripped)
        // console.log(data.essies[0].html_description)

        const dc = data.dining_center
        const es = data.essies[0]
        const sc = data.science_center[0]
        const kb = data.kohlberg[0]

        var DiningCenterObject = {};
        var EssiesObject = {};
        var ScienceCenterObject = {};
        var KohlbergObject = {};



        if (dc.length) {
            for (let menu of dc) {
                let title = menu.title.toLowerCase();
                // console.log("NEW MENU NEW MENU: " + title + " \n\n")

                DiningCenterObject[title] = objectifier('sharples', menu.html_description);

                let time = menu.short_time.split(' ').filter(x => x !== '-');
                DiningCenterObject[title]['start'] = time[0];
                DiningCenterObject[title]['end'] = time[1];

                DiningCenterObject[title]['time'] = menu.short_time;
            };

            DiningCenterObject['open'] = true;
        } else {
            DiningCenterObject['open'] = false;
            DiningCenterObject['desc'] = "The Dining Center is closed.";
        }

        if (es) {
            EssiesObject = objectifier('essies', es.description);

            let time = es.short_time.split(' ').filter(x => x !== '-');
            EssiesObject['start'] = time[0];
            EssiesObject['end'] = time[1];

            EssiesObject['time'] = es.short_time;

            EssiesObject['open'] = true;
        } else {
            EssiesObject['open'] = false;
            EssiesObject['desc'] = "Essie's Corner is closed.";
        }

        if (sc) {
            ScienceCenterObject = objectifier('science_center', sc.html_description);

            let time = sc.short_time.split(' ').filter(x => x !== '-');
            ScienceCenterObject['start'] = time[0];
            ScienceCenterObject['end'] = time[1];

            ScienceCenterObject['time'] = es.short_time;

            ScienceCenterObject['open'] = true;
        } else {
            ScienceCenterObject['open'] = false;
            EssiesObject['desc'] = "The Science Center Cafe is closed.";
        }


        if (kb) {
            KohlbergObject = objectifier('kohlberg', kb.html_description);

            let time = kb.short_time.split(' ').filter(x => x !== '-');
            KohlbergObject['start'] = time[0];
            KohlbergObject['end'] = time[1];

            KohlbergObject['time'] = kb.short_time;
            KohlbergObject['open'] = true;
        } else {
            KohlbergObject['open'] = false;
            KohlbergObject['desc'] = "Kholberg Coffee Bar is closed.";
        }

        result["TimeOfGeneration"] = new Date().toString();
        let now = new Date();
        result["date"] = new Date(now.getFullYear(), now.getMonth(), now.getDate(), -5, 0, 0, 0);

        result["Dining Center"] = DiningCenterObject;
        result["Essies"] = EssiesObject;
        result["Science Center"] = ScienceCenterObject;
        result["Kohlberg"] = KohlbergObject;
        // result["Crumb"] = await CrumbObject() ? await CrumbObject() : null;
        result["metadata"] = "generated";

        let { TimeOfGeneration, date, ...payload } = result
        result["hash"] = hash(payload)

        return result
    });
};



app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    next();
});


app.get('/api', async (req, res) => {
    // if something was cached, return it
    if (cachedData) {
        res.json(cachedData);
        console.log("Data cached found, responding...")
        return
    }

    // console.log(hash(cachedData))

    // failsafe, just generate the object, cache it, and return it
    // console.log("No data cached, generating new object...")

    cachedData = await DiningObject()
    res.json(cachedData)
});

app.get('/', (req, res) => {
    res.json({});
});

// view the actual json being extracted
app.get('/data', async (req, res) => {
    res.json(await Get(url))
});

app.get('/crumb', async (req, res) => {
    res.json(await CrumbObject())
});

var cachedData;

app.listen(PORT, async () => {
    console.log(`Server is listening at port:${PORT}`);
    while (true) {
        cachedData = await DiningObject();
        cachedData["metadata"] = "cached";
        await new Promise(r => setTimeout(r, 7200000));
    }
});
