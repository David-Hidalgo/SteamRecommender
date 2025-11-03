import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
const MODEL_NAME = process.env.GOOGLE_EMBEDDING_MODEL;

if (!API_KEY) {
	throw new Error("No se definio GOOGLE_API_KEY o GEMINI_API_KEY para generar embeddings.");
}

if (!MODEL_NAME) {
	throw new Error("No se definio GOOGLE_EMBEDDING_MODEL para generar embeddings.");
}

const googleGenAI = new GoogleGenAI({ apiKey: API_KEY });

// Generates an embedding vector using the Gemini embeddings model.
export const getEmbedding = async (text) => {
	const clean = typeof text === "string" ? text.trim() : "";
	if (clean.length === 0) {
		throw new Error("El texto para generar embedding está vacío.");
	}

	const response = await googleGenAI.models.embedContent({
		model: MODEL_NAME,
		contents: [clean],
	});

	const vector = response?.embeddings?.[0]?.values;
	if (!Array.isArray(vector) || vector.length === 0) {
		throw new Error("No se recibió un embedding válido desde Gemini.");
	}
	return vector;
};
