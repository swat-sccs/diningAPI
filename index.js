const express = require('express');
const hash = require('object-hash');
const app = express();
const PORT = 8080;

app.set('trust proxy', 'loopback');


const url = 'https://dash.swarthmore.edu/dining_json';

const KBMenuRegex = /(?:Menu|order)(.+)<\/i>/gi;
const KBSoupRegex = /Soup(?:\s?)-(?:\s?)(.+?)</;

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
                const menuTitle = match[1];
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
        // case 'science_center': // doesn't contain any meaningful data
        //     ret["test"] = 'test'
        //     return ret;
        case 'kohlberg':
            const KBSoupMatch = html.match(KBSoupRegex);
            const KBSoup = KBSoupMatch ? KBSoupMatch[1].trim() : null;
            ret['soup'] = KBSoup;

            const menuMatch = html.match(KBMenuRegex);
            // const menuMatch = html.match(/m/);
            if (menuMatch) {
                const items = menuMatch[0].split('</p>').map(item => item.trim());
                // console.log(items)
                const menuItems = items.slice(0).map(instance => {
                    const item = stripHtmlTags(instance);
                    if (item == '') {
                        return {};
                    }

                    const properties = [];

                    return { item, properties };
                });

                ret['menu'] = menuItems;
            } else {
                console.log('No Kolhberg menu found.');
                ret['menu'] = null;
            }
            return ret;
    };

};


async function DiningObject() {
    return Get(url).then(data => {
        const result = {}

        // console.log(data.dining_center[2])
        // const stripped = stripHtmlTags(data.essies[0].html_description)
        // console.log(stripped)
        // console.log(data.essies[0].html_description)

        const dc = data.dining_center
        const es = data.essies[0]
        // const sc = data.science_center[0]
        const kb = data.kohlberg[0]

        var DiningCenterObject = {};
        var EssiesObject = {};
        // var ScienceCenterObject = {};
        var KohlbergObject = {};

        // DiningCenterObject['test'] = objectifier('sharples', dc[2].html_description);


        if (dc) {
            for (let menu of dc) {
                let title = menu.title.toLowerCase();
                // console.log("NEW MENU NEW MENU: " + title + " \n\n")

                DiningCenterObject[title] = objectifier('sharples', menu.html_description);

                let time = menu.short_time.split(' ').filter(x => x !== '-');
                DiningCenterObject[title]['start'] = time[0];
                DiningCenterObject[title]['end'] = time[1];

                DiningCenterObject[title]['time'] = menu.short_time;
            };
        }

        if (es) {
            EssiesObject = objectifier('essies', es.description);

            let time = es.short_time.split(' ').filter(x => x !== '-');
            EssiesObject['start'] = time[0];
            EssiesObject['end'] = time[1];

            EssiesObject['time'] = es.short_time;
        }

        // ScienceCenterObject = objectifier('science_center', sc.html_description);

        if (kb) {
            KohlbergObject = objectifier('kohlberg', kb.html_description);

            let time = kb.short_time.split(' ').filter(x => x !== '-');
            KohlbergObject['start'] = time[0];
            KohlbergObject['end'] = time[1];

            KohlbergObject['time'] = kb.short_time;
        }

        result["Dining Center"] = DiningCenterObject;
        result["Essies"] = EssiesObject;
        // result["Science Center"] = ScienceCenterObject;
        result["Kohlberg"] = KohlbergObject;
        result["metadata"] = "generated";

        let now = new Date();
        result["date"] = new Date(now.getFullYear(), now.getMonth(), now.getDate(), -5, 0, 0, 0);

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
        // console.log("Data cached found, responding...")
        res.json(cachedData);
        return
    }

    // console.log(hash(cachedData))

    // failsafe, just generate the object, cache it, and return it
    // console.log("No data cached, generating new object...")

    cachedData = await DiningObject()
    res.json(cachedData)
    cachedData["metadata"] = "cached";
    return
});

app.get('/', (req, res) => {
    res.json({});
});

// view the actual json being extracted
app.get('/data', async (req, res) => {
    Get(url).then(data => {
        res.json(data);
    })
});

var cachedData;

app.listen(PORT, async () => {
    console.log(`Server is listening at port:${PORT}`);
    cachedData = await DiningObject();
});