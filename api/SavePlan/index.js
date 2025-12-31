const { CosmosClient } = require("@azure/cosmos");

// Azure henter disse automatisk fra "Environment variables" du la inn
const endpoint = process.env.COSMOS_ENDPOINT;
const key = process.env.COSMOS_KEY;

const client = new CosmosClient({ endpoint, key });

module.exports = async function (context, req) {
    const container = client.database("UkeplanDB").container("Planer");
    try {
        await container.items.upsert(req.body);
        context.res = { status: 200, body: "Lagret i skyen!" };
    } catch (err) {
        context.res = { status: 500, body: err.message };
    }
};
