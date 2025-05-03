import puppeteer from 'puppeteer';
import fs from 'fs/promises';

async function scrapeLeetCode() {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();

    try {
        await page.goto('https://leetcode.com/problemset/', {
            waitUntil: 'networkidle2',
            timeout: 0
        });

        // Accept cookies if prompted
        try {
            await page.click('[data-cy="cookie-policy-banner-accept"]', { timeout: 3000 });
        } catch { }

        // Scroll to load more problems
        let lastHeight = await page.evaluate(() => document.body.scrollHeight);
        let questionsLoaded = 0;
        let maxScrolls = 15;

        for (let i = 0; i < maxScrolls; i++) {
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await new Promise(resolve => setTimeout(resolve, 1500));

            questionsLoaded = await page.evaluate(() =>
                document.querySelectorAll('div[role="rowgroup"] > div[role="row"]').length
            );

            if (questionsLoaded >= 50) break;

            const newHeight = await page.evaluate(() => document.body.scrollHeight);
            if (newHeight === lastHeight) break;
            lastHeight = newHeight;
        }

        // Extract question data
        const questions = await page.evaluate(() => {
            const rows = Array.from(document.querySelectorAll('div[role="rowgroup"] > div[role="row"]'));
            const data = [];

            for (let i = 0; i < Math.min(50, rows.length); i++) {
                const row = rows[i];
                const anchor = row.querySelector('a[href*="/problems/"]');
                const columns = row.querySelectorAll('div[role="cell"]');

                if (anchor && columns.length >= 3) {
                    data.push({
                        title: anchor.textContent.trim(),
                        difficulty: columns[2].textContent.trim(),
                        link: 'https://leetcode.com' + anchor.getAttribute('href')
                    });
                }
            }

            return data;
        });

        await fs.writeFile('leetcode-questions.json', JSON.stringify(questions, null, 2));
        console.log(`✅ Scraped ${questions.length} questions and saved to leetcode-questions.json`);
    } catch (error) {
        console.error('❌ Error occurred:', error);
    } finally {
        await browser.close();
    }
}

scrapeLeetCode();
