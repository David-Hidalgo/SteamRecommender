import mongoose from "mongoose";

const { Schema, model } = mongoose;

const gameSchema = new Schema(
	{
		appid: { type: Number, required: true, unique: true },
		name: { type: String, required: true },
		data: { type: Schema.Types.Mixed, required: true },
	},
	{ collection: "game" },
);
// text index on name to support text search
gameSchema.index({ name: "text" });
export const Game = model("Game", gameSchema);

type GameType = mongoose.InferSchemaType<typeof gameSchema>;
export type { GameType };
