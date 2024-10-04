const express = require('express');
const hash = require('object-hash');
const app = express();
const PORT = 8080;

app.set('trust proxy', 'loopback');


const url = 'https://dash.swarthmore.edu/dining_json';

const KBMenuRegex = /(?:<p><i>)(.+)<\/i><\/p>/gi;
const KBSoupRegex = /Soup(?:\s?)-(?:\s?)(.+?)</;

var cachedData;


// remove all <></> tags, trim whitespace, and replace double spaces with single ones 
function stripHtmlTags(s) {
    if (!s) return null;
    return s.replace(/<\/?[^>]+(>|$)/g, '').trim().replace(/\s{2,}/g, ' ');
}

async function Get(url) {
    const response = await fetch(url);
    const data = await response.json();
    return data;
};

const sortEntrees = (items) => {
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


function objectifier(venue, html) {
    const ret = {};
    switch (venue) {
        case 'dining_center':
            const regex = /<span(?:.+?)>(.+?)<\/span><ul><li>(.+?)<\/li><\/ul>/gm;

            var match;

            // TODO: FIX THIS VULNERABILITY
            // SHOULD NOT RELY ON EXEC
            while ((match = regex.exec(html)) !== null) {
                // console.log(match)
                const menuTitle = match[1] == 'brunch' ? 'lunch' : match[1];
                const menuItems = match[2];

                const items = sortEntrees(menuItems);
                ret[menuTitle] = items;
            }

            return ret;
        case 'essies':
            const soupMatch = html.match(/Soup-(.*?) Today's Lunch Special/);
            const lunchMatch = html.match(/Today'?s Lunch Special\s+([^.]+)/);
            const mealMatch = html.match(/local food vendor will be\s+([^.]+)/);

            const ESSoup = soupMatch ? soupMatch[1] : null;
            const ESLunch = lunchMatch ? lunchMatch[1] : null;
            const ESMeal = mealMatch ? mealMatch[1] : null;

            // console.log("Essie's Soup: " + ESSoup);
            // console.log("Essie's Special: " + ESLunch);
            // console.log("Essie's Meal: " + ESMeal);

            ret['soup'] = stripHtmlTags(ESSoup);
            ret['special'] = stripHtmlTags(ESLunch);
            ret['meal'] = stripHtmlTags(ESMeal);

            return ret;
        case 'science_center':
            ret["vendor"] = html.match(/<span>(.*?)<\/span>/) ? html.match(/<span>(.*?)<\/span>/)[1] : null
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

            const items = menuMatch[0].split('<br>').map(item =>
                stripHtmlTags(item
                    .trim()
                    .replace("&amp;", "&")
                    .replace(new RegExp("menu", "ig"), "")
                )
            );

            const menuItems = items.map(item => {
                // console.log(item)
                if (item != '' && item != 'GET' && item) {
                    return { item, properties: [] };
                }
            });

            ret['menu'] = menuItems.filter(n => n);

            return ret;

    };

};

async function DiningObject() {
    return Get(url).then(async data => {
        const result = {}

        const venues = ['dining_center', 'essies', 'kohlberg', 'science_center']

        for (let venue of venues) {
            let subtree = data[venue];

            let venueObject = {
                'meals': {},
                'venue': venue,
                'open': false,
            };

            if (!subtree.length) {
                result[venue] = venueObject;
                continue;
            }

            for (let menu of subtree) {
                let title = menu.title.trim();
                if (title == 'brunch') title = 'lunch';
                if (title == 'Essie\'s Corner Open') title = 'Essies';
                if (title == 'Kohlberg Open') title = 'Kohlberg';
                venueObject.meals[title] = objectifier(venue, menu.html_description);
                venueObject.meals[title]['venue'] = venue;
                venueObject.meals[title]['time'] = menu.short_time;
                venueObject.meals[title]['desc'] = menu.description;
                venueObject.meals[title]['html_desc'] = menu.html_description;

            };
            venueObject['open'] = true;

            result[venue] = venueObject
        };

        result["metadata"] = "generated";
        result["hash"] = hash(result)
        result["TimeOfGeneration"] = new Date().toString();

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
