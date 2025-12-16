const puppeteer = require('puppeteer');

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox'] });
    const page = await browser.newPage();
    // Pipe browser console to stderr
    page.on('console', msg => console.error(`BROWSER LOG: ${msg.text()}`));
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // console.error('Navigating...'); // Use stderr for logs so stdout is clean for JSON
    try {
        await page.goto('https://tradingeconomics.com/stocks', { waitUntil: 'networkidle2', timeout: 60000 });
    } catch (e) {
        console.error(JSON.stringify([]));
        await browser.close();
        process.exit(1);
    }

    const data = await page.evaluate(() => {
        const results = [];
        const rows = document.querySelectorAll('tr');

        // whitelist
        const TARGETS = ['US500', 'US30', 'JP225', 'SHANGHAI', 'TSX', 'CSI 300', 'HNX', 'VN'];

        rows.forEach((row, index) => {
            const cells = row.querySelectorAll('td');
            // Debug first 5 rows
            if (index < 5) console.error(`Row ${index} cells: ${cells.length}, Text: ${row.innerText.substring(0, 50)}...`);

            if (cells.length < 2) return;

            // Search in entire row, not just cell 0 (to match original script)
            const nameEl = row.querySelector('b') || row.querySelector('a');
            if (!nameEl) return;

            let rawName = nameEl.innerText.trim();
            if (!rawName) return;

            // Debug name extraction
            if (index < 5) {
                console.error(`Row ${index} Name: '${rawName}'`);
                console.error(`Row ${index} Cell 1 text: '${cells[1]?.innerText}'`);
            }

            // Restore whitelist
            const TARGETS = ['US500', 'US30', 'JP225', 'SHANGHAI', 'TSX', 'CSI 300', 'HNX', 'VN'];
            if (!TARGETS.includes(rawName)) return;

            const parseVal = (str) => str ? parseFloat(str.replace(/,/g, '')) : null;
            const parsePct = (str) => str ? parseFloat(str.replace('%', '')) / 100 : null;

            // Check cells length again
            if (cells.length < 9) return; // Need up to index 8

            const price = parseVal(cells[2]?.innerText.trim());
            const change = parseVal(cells[3]?.innerText.trim());
            const percentChange = parsePct(cells[4]?.innerText.trim());
            const weekly = parsePct(cells[5]?.innerText.trim());
            const monthly = parsePct(cells[6]?.innerText.trim());
            const ytd = parsePct(cells[7]?.innerText.trim());
            const yoy = parsePct(cells[8]?.innerText.trim());

            results.push({
                name: rawName,
                price: price || 0,
                change: change || 0,
                percentChange: percentChange || 0,
                weekly: weekly || 0,
                monthly: monthly || 0,
                ytd: ytd || 0,
                yoy: yoy || 0
            });
        });
        return results;
    });

    console.log(JSON.stringify(data, null, 2));
    await browser.close();
})();
