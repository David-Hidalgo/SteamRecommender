import { MongoClient } from "mongodb";
import { getEmbedding } from "./get-embeddings.js";

// MongoDB connection URI and options
const client = new MongoClient(process.env.DATABASE_URL);

async function run() {
	try {
		// Connect to the MongoDB client
		await client.connect();

		// Specify the database and collection
		const database = client.db("SteamRecommender");
		const collection = database.collection("game");
		
		// Generate embedding for the search query
		const queryEmbedding = await getEmbedding("pelota");

		// Define the sample vector search pipeline
		const pipeline = [
			{
				$vectorSearch: {
					index: "vector_index",
					queryVector: queryEmbedding,
					path: "embedding",
					exact: true,
					limit: 5,
				},
			},
			{
				$project: {
					_id: 1,							
					appid:1,
					name:1,
					score: { $meta: "vectorSearchScore" },
					capsule: "$data.capsule_image",
					release_date: "$data.release_date",
					vectorIndex: "$data.vectorIndex"
				},
			},
		];

		// run pipeline
		const result = collection.aggregate(pipeline);

		// print results
		for await (const doc of result) {
			console.dir(JSON.stringify(doc));
		}
	} finally {
		await client.close();
	}
}
run().catch(console.dir);
