const puppeteer = require('puppeteer');
const { Client } = require('@notionhq/client');
require('dotenv').config();

// Configuration
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID; // Ensure this is set in .env
const TARGET_URL = 'https://tradingeconomics.com/commodities';

async function scrapeCommodities() {
    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    console.log(`Navigating to ${TARGET_URL}...`);
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 60000 });

    console.log('Extracting data...');
    const commodities = await page.evaluate(() => {
        const data = [];
        const rows = document.querySelectorAll('tr');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 8) return; // Need at least 8 columns now

            const nameEl = cells[0].querySelector('b');
            if (!nameEl) return;

            const rawName = nameEl.innerText.trim();
            const rawText = cells[0].innerText.trim();
            // The unit often appears after the name. The cell text is "Name\nUnit". 
            // Or "Name Unit". Let's try to extract it by removing the Name part from the full text.
            // Or looking for the text node.

            let unit = '';
            // Strategy 1: Text node check
            if (nameEl.nextSibling && nameEl.nextSibling.nodeType === 3) {
                unit = nameEl.nextSibling.textContent.trim();
            }
            // Strategy 2: If node check fails, parse innerText
            if (!unit) {
                // Example: "Bitumen\nCNY/T"
                const parts = rawText.split('\n');
                if (parts.length > 1) {
                    unit = parts[parts.length - 1].trim();
                }
            }

            const name = unit ? `${rawName} (${unit})` : rawName;

            const price = parseFloat(cells[1].innerText.trim().replace(/,/g, ''));
            const change = parseFloat(cells[2].innerText.trim().replace(/,/g, ''));
            const percentChangeContent = cells[3].innerText.trim().replace('%', '');
            const percentChange = parseFloat(percentChangeContent);

            const weeklyContent = cells[4].innerText.trim().replace('%', '');
            const weekly = parseFloat(weeklyContent);

            const monthlyContent = cells[5].innerText.trim().replace('%', '');
            const monthly = parseFloat(monthlyContent);

            const ytdContent = cells[6].innerText.trim().replace('%', '');
            const ytd = parseFloat(ytdContent);

            const yoyContent = cells[7].innerText.trim().replace('%', '');
            const yoy = parseFloat(yoyContent);

            if (!isNaN(price) && rawName) {
                data.push({
                    name,
                    price,
                    change,
                    percentChange,
                    weekly,
                    monthly,
                    ytd,
                    yoy
                });
            }
        });
        return data;
    });

    console.log(`Extracted ${commodities.length} commodities.`);
    await browser.close();
    return commodities;
}

async function updateNotion(commodities) {
    if (!process.env.NOTION_TOKEN || !NOTION_DATABASE_ID) {
        console.warn('Missing Notion credentials. Skipping Notion update.');
        console.log('Sample Data:', commodities.slice(0, 5));
        return;
    }

    const notion = new Client({ auth: process.env.NOTION_TOKEN });

    console.log('Querying existing database items...');
    let existingItems = new Map();
    let hasMore = true;
    let startCursor = undefined;

    // Pagination loop
    while (hasMore) {
        const response = await notion.databases.query({
            database_id: NOTION_DATABASE_ID,
            start_cursor: startCursor,
        });

        response.results.forEach(page => {
            const titleProp = page.properties.Name;
            if (titleProp && titleProp.title && titleProp.title.length > 0) {
                const name = titleProp.title[0].plain_text;
                existingItems.set(name, page.id);
            }
        });

        hasMore = response.has_more;
        startCursor = response.next_cursor;
    }

    console.log(`Found ${existingItems.size} existing items.`);
    console.log('Updating/Creating Notion pages...');

    for (const item of commodities) {
        const existingPageId = existingItems.get(item.name);

        try {
            const properties = {
                'Price': { number: isNaN(item.price) ? null : item.price },
                'Change': { number: isNaN(item.change) ? null : item.change },
                '% Change': { number: isNaN(item.percentChange) ? null : item.percentChange },
                'Weekly': { number: isNaN(item.weekly) ? null : item.weekly },
                'Monthly': { number: isNaN(item.monthly) ? null : item.monthly },
                'YTD': { number: isNaN(item.ytd) ? null : item.ytd },
                'YoY': { number: isNaN(item.yoy) ? null : item.yoy },
            };

            if (existingPageId) {
                // Update
                process.stdout.write(`.`);
                await notion.pages.update({
                    page_id: existingPageId,
                    properties: properties
                });
            } else {
                // Create
                process.stdout.write(`+`);
                properties['Name'] = { title: [{ text: { content: item.name } }] };
                await notion.pages.create({
                    parent: { database_id: NOTION_DATABASE_ID },
                    properties: properties
                });
            }
        } catch (error) {
            console.error(`\nFailed to sync ${item.name}:`, error.message);
        }
    }
    console.log('\nSync complete.');
}

(async () => {
    try {
        const data = await scrapeCommodities();
        if (data.length > 0) {
            await updateNotion(data);
        } else {
            console.warn('No data found during scrape.');
        }
    } catch (e) {
        console.error('Script failed:', e);
        process.exit(1);
    }
})();
