const { Client } = require('@notionhq/client');
require('dotenv').config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

(async () => {
    try {
        const response = await notion.databases.retrieve({ database_id: databaseId });
        console.log('Database Properties:');
        Object.keys(response.properties).forEach(propName => {
            const prop = response.properties[propName];
            console.log(`- "${propName}" (${prop.type})`);
        });
    } catch (error) {
        console.error(error);
    }
})();
