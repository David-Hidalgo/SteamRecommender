import { MongoClient } from "mongodb";
import { getEmbedding } from "./get-embeddings.js";

// import { convertEmbeddingsToBSON } from './convert-embeddings.js';

async function run() {
	// Connect to your MongoDB deployment
	const client = new MongoClient(process.env.MONGODB_URI);

	try {
		await client.connect();
		const db = client.db("SteamRecommender");
		const collection = db.collection("game");

		// Filter to exclude null or empty detailed_description fields
		const filter = { "data.detailed_description": { $nin: [null, ""] } };

		// Get a subset of documents from the collection
		const documents = await collection.find(filter).toArray();

		console.log("Generating embeddings and updating documents...");
		const updateDocuments = [];
		await Promise.all(
			documents.map(async (doc) => {
				// Generate an embedding using the function that you defined
				var embedding = await getEmbedding(doc.data.detailed_description);

				// Uncomment the following lines to convert the generated embedding into BSON format
				// const bsonEmbedding = await convertEmbeddingsToBSON([embedding]); // Since convertEmbeddingsToBSON is designed to handle arrays
				// embedding = bsonEmbedding; // Use BSON embedding instead of the original float32 embedding

				// console.log(embedding);

				// Add the embedding to an array of update operations
				updateDocuments.push({
					updateOne: {
						filter: { _id: doc._id },
						update: { $set: { embedding: embedding } },
					},
				});
				console.log(`document updated: ${doc._id}`);
			}),
		);

		// Continue processing documents if an error occurs during an operation
		const options = { ordered: false };

		// Update documents with the new embedding field
		const result = await collection.bulkWrite(updateDocuments, options);
		console.log("Count of documents updated: " + result.modifiedCount);
	} catch (err) {
		console.log(err.stack);
	} finally {
		await client.close();
	}
}
run().catch(console.dir);
