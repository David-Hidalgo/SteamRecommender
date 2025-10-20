import "dotenv/config";
import mongoose from "mongoose";

// Desactivar el buffering para que falle rápido si no hay conexión
mongoose.set("bufferCommands", false);

const uri = process.env.DATABASE_URL;
if (!uri || uri.trim() === "") {
	throw new Error(
		"DATABASE_URL no está definida. Configúrala en tu entorno o en un archivo .env",
	);
}

try {
	await mongoose.connect(uri);
} catch (error) {
	console.error("Error connecting to database:", error);
	throw error;
}

// Usa el nombre de BD del env si se define, si no, por defecto 'myDB'
const dbName = process.env.DB_NAME || "myDB";
const client = mongoose.connection.getClient().db(dbName);

export { client };
