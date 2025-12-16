const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const LOGIN_URL = 'https://vdsc.com.vn/dang-nhap';
const COOKIE_FILE = path.join(__dirname, 'vdsc_cookies.json');

async function setupCookies() {
    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox']
    });

    const pages = await browser.pages();
    const page = pages.length > 0 ? pages[0] : await browser.newPage();

    // Stealth
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    try {
        await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

        console.log('👉 ACTION REQUIRED: Log in securely in the browser window.');
        console.log('   I will check for success every 2 seconds...');

        let attempts = 0;
        const maxAttempts = 150; // 5 minutes (150 * 2s)

        while (attempts < maxAttempts) {
            await new Promise(r => setTimeout(r, 2000));
            attempts++;

            if (browser.isConnected() === false) {
                console.log('❌ Browser was closed manually.');
                break;
            }

            try {
                // Check URL
                const url = page.url();
                const cookies = await page.cookies();

                // Detection logic:
                // 1. Not on login page
                // 2. Has some VDSC cookies
                const hasAuthCookie = cookies.some(c => c.name.includes('.ASPXAUTH') || c.name.includes('.AspNetCore.Identity.Application') || c.name.includes('RV'));

                if (!url.includes('dang-nhap') && hasAuthCookie) {
                    console.log('✅ Login detected! (URL changed + Cookies found)');

                    const vdscCookies = cookies.filter(c => c.domain.includes('vdsc.com.vn'));
                    fs.writeFileSync(COOKIE_FILE, JSON.stringify(vdscCookies, null, 2));
                    console.log(`💾 Cookies saved to ${COOKIE_FILE}`);

                    console.log('👋 Closing browser in 3 seconds...');
                    await new Promise(r => setTimeout(r, 3000));
                    await browser.close();
                    return;
                }

                // Feedback every 10s
                if (attempts % 5 === 0) {
                    process.stdout.write('.');
                }

            } catch (err) {
                // If page closed or navigation happens
            }
        }

        console.log('\n❌ Timeout waiting for login.');
        await browser.close();

    } catch (e) {
        console.error('❌ Script Error:', e.message);
    }
}

setupCookies();
