const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

(async () => {
    try {
        const response = await notion.databases.retrieve({ database_id: process.env.NOTION_DATABASE_ID });
        console.log('Database Properties:');
        Object.keys(response.properties).forEach(key => {
            console.log(`- ${key}: ${response.properties[key].type}`);
        });
    } catch (e) {
        console.error(e);
    }
})();
