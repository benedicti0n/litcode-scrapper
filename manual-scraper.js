import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import fs from 'fs/promises';
import { executablePath } from 'puppeteer';

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin());

async function scrapeLeetCodeManually() {
    console.log('Launching browser...');

    const browser = await puppeteer.launch({
        headless: false, // Show browser for manual intervention
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

        console.log('\n🔍 MANUAL INTERVENTION REQUIRED');
        console.log('---------------------------------------');
        console.log('Please follow these steps:');
        console.log('1. Solve any CAPTCHA if presented');
        console.log('2. Wait for the problem list to fully load');
        console.log('3. When you can see the problem list, press ENTER in this terminal');
        console.log('---------------------------------------\n');

        // Wait for user to press Enter
        process.stdin.setEncoding('utf8');
        await new Promise(resolve => {
            process.stdin.once('data', data => {
                resolve();
            });
        });

        console.log('Continuing with scraping...');

        // Take a screenshot of the current state
        await page.screenshot({ path: 'leetcode-ready.png', fullPage: true });
        console.log('Screenshot saved as leetcode-ready.png');

        // Extract data using page.evaluate
        const problems = await page.evaluate(() => {
            // Define a function to safely extract data
            const safeExtract = (element, selector, attribute = null) => {
                try {
                    if (!element) return '';
                    const found = element.querySelector(selector);
                    if (!found) return '';
                    if (attribute) return found.getAttribute(attribute) || '';
                    return found.textContent.trim();
                } catch (e) {
                    return '';
                }
            };

            const results = [];

            // Try multiple ways to find problem rows
            // These are the most common patterns seen in the UI
            const rowElements = document.querySelectorAll('div[role="row"]') ||
                document.querySelectorAll('tr') ||
                document.querySelectorAll('[class*="odd:bg"]');

            console.log(`Found ${rowElements.length} potential problem rows`);

            // Process each row
            rowElements.forEach((row, index) => {
                // Skip header row
                if (row.getAttribute('role') === 'rowheader' || index === 0) return;

                try {
                    // Try to extract the link element - this is the most reliable part
                    const link = row.querySelector('a');

                    if (link && link.href && link.href.includes('/problems/')) {
                        const href = link.getAttribute('href');
                        const title = link.textContent.trim();

                        // Find number - usually in the first cell or near the beginning
                        let number = '';
                        const cells = row.querySelectorAll('div[role="cell"]') || row.querySelectorAll('td') || row.children;
                        if (cells.length > 0) {
                            number = cells[0].textContent.trim();
                        }

                        // Find difficulty - usually in one of the later cells
                        let difficulty = '';
                        if (cells.length > 2) {
                            for (let i = cells.length - 1; i >= 0; i--) {
                                const text = cells[i].textContent.trim().toLowerCase();
                                if (['easy', 'medium', 'hard'].includes(text)) {
                                    difficulty = text;
                                    break;
                                }
                            }
                        }

                        // Add to results if we found a title
                        if (title) {
                            results.push({
                                number: number,
                                title: title,
                                difficulty: difficulty,
                                link: href.startsWith('http') ? href : 'https://leetcode.com' + href
                            });
                        }
                    }
                } catch (err) {
                    // Skip problematic rows
                    console.log(`Error processing row ${index}: ${err.message}`);
                }
            });

            return results;
        });

        console.log(`Found ${problems.length} problems!`);

        // If no problems found, try looking for any links related to problems
        if (problems.length === 0) {
            console.log('No problems found with main selectors. Trying alternative approach...');

            const links = await page.evaluate(() => {
                const problemLinks = [];
                const anchors = document.querySelectorAll('a[href*="/problems/"]');

                anchors.forEach(a => {
                    if (a.href && a.textContent) {
                        problemLinks.push({
                            title: a.textContent.trim(),
                            link: a.href,
                            difficulty: 'Unknown'
                        });
                    }
                });

                return problemLinks;
            });

            if (links.length > 0) {
                console.log(`Found ${links.length} problem links via alternative method`);
                await fs.writeFile('leetcode-problems.json', JSON.stringify(links, null, 2));
                console.log('Problem links saved to leetcode-problems.json');
            } else {
                console.log('Could not find any problem links on the page.');
            }
        } else {
            // Save results to file
            await fs.writeFile('leetcode-problems.json', JSON.stringify(problems, null, 2));
            console.log(`✅ Successfully scraped ${problems.length} problems and saved to leetcode-problems.json`);
        }

        // Keep browser open for a bit to see results
        console.log('Browser will close in 5 seconds...');
        await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
        console.error('❌ Error occurred:', error);
        await page.screenshot({ path: 'error-screenshot.png' });
        console.log('Error screenshot saved as error-screenshot.png');
    } finally {
        await browser.close();
    }
}

scrapeLeetCodeManually();