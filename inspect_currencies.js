const puppeteer = require('puppeteer');

(async () => {
    // Launch args to match working stocks script
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();

    // Pipe browser console to stderr for debugging
    page.on('console', msg => console.error(`BROWSER LOG: ${msg.text()}`));

    // Use verified User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    try {
        await page.goto('https://tradingeconomics.com/currencies', { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
        console.error(JSON.stringify([]));
        await browser.close();
        process.exit(1);
    }

    const data = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('tr');

        // whitelist
        const TARGETS = ['EURUSD', 'GBPUSD', 'USDCAD', 'DXY', 'USDJPY', 'USDCNY', 'USDKRW', 'USDTHB', 'USDVND'];

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');

            // Debug first few rows
            if (index < 5) console.error(`Row ${index} cells: ${cells.length}, Text: ${row.innerText.substring(0, 50)}...`);

            if (cells.length < 2) return;

            // Search for name in the whole row (robustness)
            const nameEl = row.querySelector('b') || row.querySelector('a');
            if (!nameEl) return;

            let rawName = nameEl.innerText.trim();
            if (!rawName) return;

            // Debug matching
            if (TARGETS.includes(rawName)) {
                console.error(`Found target ${rawName}. Cells: ${cells.length}`);
            }

            if (!TARGETS.includes(rawName)) return;

            const parseVal = (str) => str ? parseFloat(str.replace(/,/g, '')) : null;
            const parsePct = (str) => str ? parseFloat(str.replace('%', '')) / 100 : null;

            if (cells.length < 9) return;

            // Corrected indices (Price at index 2, like Stocks)
            const price = parseVal(cells[2]?.innerText.trim());
            const change = parseVal(cells[3]?.innerText.trim());
            const percentChange = parsePct(cells[4]?.innerText.trim());

            results.push({
                name: rawName,
                price: price || 0,
                change: change || 0,
                percentChange: percentChange || 0,
                weekly: parsePct(cells[5]?.innerText.trim()) || 0,
                monthly: parsePct(cells[6]?.innerText.trim()) || 0,
                ytd: parsePct(cells[7]?.innerText.trim()) || 0,
                yoy: parsePct(cells[8]?.innerText.trim()) || 0
            });
        });
        return results;
    });

    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
