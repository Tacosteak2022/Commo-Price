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
        await page.goto('https://tradingeconomics.com/bonds', { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
        console.error(JSON.stringify([]));
        await browser.close();
        process.exit(1);
    }

    const data = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('tr');

        // whitelist
        const TARGETS = ['United Kingdom', 'United States', 'Japan', 'Canada', 'Vietnam', 'China', 'Indonesia'];
        // Note: Bonds page names might be slightly different like "U.S. 10Y". We'll inspect rows.
        // Actually, user asked for "United Kingdom, United States..." which implies 10Y or generic. 
        // TradingEconomics bonds page usually lists countries with 10Y yield by default or specific names.
        // We will log names first to confirm.

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');

            // Debug first few rows to check structure
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

            // For Bonds, "United States" might be "United States 10Y" etc. 
            // We'll check simplified matching if exact fails.
            const isTarget = TARGETS.includes(rawName) || TARGETS.some(t => rawName === t + ' 10Y');

            if (!isTarget) return;

            const parseVal = (str) => str ? parseFloat(str.replace(/,/g, '')) : null;
            const parsePct = (str) => str ? parseFloat(str.replace('%', '')) / 100 : null;

            // Check structure using same assumption asStocks (Shifted indices)
            if (cells.length < 9) return;

            // Standard Shifted Mapping (Price at index 2)
            const price = parseVal(cells[2]?.innerText.trim());
            const change = parseVal(cells[3]?.innerText.trim());
            const percentChange = parsePct(cells[4]?.innerText.trim());

            results.push({
                name: rawName, // Keep original name or normalize? User asked for specific list.
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
