const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

// Constants
const LOGIN_URL = 'https://vdsc.com.vn/dang-nhap';
const REPORT_URLS = ['https://vdsc.com.vn/trung-tam-phan-tich/nhan-dinh-hang-ngay/nhat-ky-chuyen-vien'];

// Manual .env parser
function loadEnv() {
    try {
        const envPath = path.join(__dirname, '.env');
        if (fs.existsSync(envPath)) {
            let content = fs.readFileSync(envPath, 'utf8');
            if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
            content.split('\n').forEach(line => {
                line = line.trim();
                if (!line || line.startsWith('#')) return;
                const eqIdx = line.indexOf('=');
                if (eqIdx > 0) process.env[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
            });
        }
    } catch (e) {
        console.warn('Could not read .env file:', e.message);
    }
}

loadEnv();

async function verifyReports() {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Scroll
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0; const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;
                if (totalHeight >= scrollHeight || totalHeight > 2000) { clearInterval(timer); resolve(); }
            }, 100);
        });
    });

    // Extract List Items
    const reports = await page.evaluate(() => {
        const data = [];
        const items = document.querySelectorAll('.list-news .item, .synthetic .item');
        items.forEach(item => {
            const titleEl = item.querySelector('.title') || item.querySelector('h4');
            const linkEl = item.tagName === 'A' ? item : item.querySelector('a');
            if (titleEl && linkEl) {
                data.push({ title: titleEl.innerText.trim(), link: linkEl.href });
            }
        });
        return data;
    });

    console.log(`Found ${reports.length} reports. Processing first 3...`);

    // 3. Process Items
    const sample = reports.slice(0, 3);
    for (const report of sample) {
        console.log(`\n📄 Processing: ${report.title}`);
        console.log(`   Initial Link: ${report.link}`);

        try {
            await page.goto(report.link, { waitUntil: 'domcontentloaded', timeout: 60000 });

            const fileLink = await page.evaluate(() => {
                if (new URLSearchParams(window.location.search).has('returnUrl')) return 'REDIRECTED_TO_LOGIN';

                const anchors = Array.from(document.querySelectorAll('a'));
                const fileAnchor = anchors.find(a => a.href && a.href.includes('/data/api/app/file-storage'));
                if (fileAnchor) return fileAnchor.href;

                const downloadAnchor = anchors.find(a => {
                    const text = a.innerText.toLowerCase();
                    return text.includes('tải về') || text.includes('download') || text.includes('tải file');
                });
                if (downloadAnchor) return downloadAnchor.href;

                const iframe = document.querySelector('iframe[src*="file-storage"]');
                if (iframe) return iframe.src;

                // Return null if redirected to login detected inside (though outer check usually catches it)
                if (document.querySelector('form[action*="login"]')) return 'REDIRECTED_TO_LOGIN';

                return null;
            });

            console.log(`   ✅ Resolved Link: ${fileLink}`);
        } catch (e) {
            console.log(`   ❌ Error: ${e.message}`);
        }
    }

    await browser.close();
}

verifyReports();
