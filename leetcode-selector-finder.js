import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import { executablePath } from 'puppeteer';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

async function findSelectors() {
    console.log('Launching browser to find selectors...');

    const browser = await puppeteer.launch({
        headless: false, // Show browser for debugging
        executablePath: executablePath(),
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--window-size=1920,1080'
        ],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

    try {
        console.log('Navigating to LeetCode...');
        await page.goto('https://leetcode.com/problemset/all/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });

        console.log('Page loaded. Waiting 5 seconds to ensure all content is visible...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Take a screenshot of what we're seeing
        await page.screenshot({ path: 'leetcode-page.png', fullPage: true });
        console.log('Screenshot saved as leetcode-page.png');

        // Let's find all possible selectors that might contain problem data
        const selectors = await page.evaluate(() => {
            const results = {};

            // Common table-like selectors
            const tableSelectors = [
                'table',
                'div[role="table"]',
                'div.table',
                '.odd\\:bg-layer-1',
                '.odd\\:bg-overlay-3'
            ];

            // Row selectors
            const rowSelectors = [
                'tr',
                'div[role="row"]',
                '.odd\\:bg-layer-1',
                '.even\\:bg-overlay'
            ];

            // For each selector, check if it exists and how many elements it finds
            [...tableSelectors, ...rowSelectors].forEach(selector => {
                try {
                    const elements = document.querySelectorAll(selector);
                    results[selector] = elements.length;
                } catch (e) {
                    results[selector] = `Error: ${e.message}`;
                }
            });

            // Let's also get the HTML of the main content area to analyze
            let mainContent = '';
            try {
                const contentElement = document.querySelector('main') ||
                    document.querySelector('.chakra-container') ||
                    document.querySelector('#__next');
                if (contentElement) {
                    mainContent = contentElement.outerHTML.substring(0, 10000); // First 10K chars
                }
            } catch (e) {
                mainContent = `Error getting content: ${e.message}`;
            }

            return {
                selectors: results,
                sampleHtml: mainContent,
                title: document.title,
                url: window.location.href
            };
        });

        console.log('Found the following selectors:');
        console.log(selectors.selectors);

        console.log('Page title:', selectors.title);
        console.log('Current URL:', selectors.url);

        // Save results to a file for analysis
        await fs.writeFile('leetcode-selectors.json', JSON.stringify(selectors, null, 2));
        console.log('Selector info saved to leetcode-selectors.json');

        // Wait for manual inspection
        console.log('Browser will stay open for 30 seconds for manual inspection. Please check the page structure.');
        console.log('Tip: Open browser developer tools (F12) and use the element inspector to find the right selectors.');
        await new Promise(resolve => setTimeout(resolve, 30000));

    } catch (error) {
        console.error('❌ Error occurred:', error);
        await page.screenshot({ path: 'error-screenshot.png' });
        console.log('Error screenshot saved as error-screenshot.png');
    } finally {
        await browser.close();
    }
}

findSelectors();