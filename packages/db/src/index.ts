import "dotenv/config";
import mongoose from "mongoose";

const uri = process.env.DATABASE_URL;
if (!uri || uri.trim() === "") {
	throw new Error(
		"DATABASE_URL no está definida. Configúrala en tu entorno o en un archivo .env",
	);
}

const connectDatabases = async () => {
	try {
		await Promise.all([mongoose.connect(uri)]);
	} catch (error) {
		console.error("Error connecting to database:", error);
		process.exit(1);
	}
};

void connectDatabases();

// Usa el nombre de BD del env si se define, si no, por defecto 'myDB'
const dbName = process.env.DB_NAME || "SteamRecommender";
const client = mongoose.connection.getClient().db(dbName);

export { client };
