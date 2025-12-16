const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

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
                if (eqIdx > 0) {
                    const key = line.substring(0, eqIdx).trim();
                    let value = line.substring(eqIdx + 1).trim();
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    process.env[key] = value;
                }
            });
        }
    } catch (e) {
        console.warn('Could not read .env file:', e.message);
    }
}

loadEnv();

(async () => {
    const email = process.env.VDSC_EMAIL;
    const password = process.env.VDSC_PASSWORD;
    const LOGIN_URL = 'https://vdsc.com.vn/dang-nhap';
    const REPORT_URL = 'https://vdsc.com.vn/trung-tam-phan-tich/nhan-dinh-hang-ngay/nhat-ky-chuyen-vien';

    if (!email || !password) {
        console.error('❌ Error: VDSC_EMAIL or VDSC_PASSWORD is not set.');
        process.exit(1);
    }

    console.log('🚀 Launching browser...');
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Stealth mode
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    // 1. Login
    console.log('🔑 Logging in to VDSC...');
    await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 2000));

    try {
        await page.waitForSelector('input[type="password"]', { timeout: 15000 });

        await page.evaluate((e, p) => {
            const userInput = document.querySelector('input[name="username"]') || document.querySelector('input[name="email"]');
            if (userInput) userInput.value = e;
            const passInput = document.querySelector('input[type="password"]');
            if (passInput) passInput.value = p;

            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                input.dispatchEvent(new Event('input', { bubbles: true }));
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('blur', { bubbles: true }));
            });
        }, email, password);

        const loginBtnSelector = '.login-button';
        await page.waitForSelector(loginBtnSelector, { visible: true });

        console.log('Clicking login...');
        await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
            page.click(loginBtnSelector)
        ]);
        console.log('✅ Logged in.');

    } catch (e) {
        console.error('⚠️ Login navigation error (non-fatal):', e.message);
        await page.screenshot({ path: 'vdsc_login_debug_retry_fail.png' });
        console.log('Current URL:', page.url());
        // Proceed anyway, maybe we are logged in or can access reports partially
    }

    // 2. Navigate to Report Page
    console.log(`🔍 Navigating to ${REPORT_URL}`);
    const reportPage = await browser.newPage(); // Use new page but share browser context (cookies)

    const links = await reportPage.evaluate(() => {
        return Array.from(document.querySelectorAll('a')).map(a => ({
            text: a.innerText,
            href: a.href,
        })).filter(l => l.href && !l.href.includes('javascript:void') && l.href.length > 20);
    });

    console.log('--- LINK SAMPLE ---');
    console.log(JSON.stringify(links.filter(l => l.href.includes('file-storage') || l.href.includes('upload') || l.href.includes('down')), null, 2));

    // Also check first normal link
    console.log('--- FIRST 5 LINKS ---');
    console.log(JSON.stringify(links.slice(0, 5), null, 2));

    await browser.close();

})();
