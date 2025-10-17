import mongoose from "mongoose";

const { Schema, model } = mongoose;

const gameSchema = new Schema(
	{
		appid: { type: Number, required: true, unique: true}
	},
	{ collection: "game" },
);
export const Game = model("Game", gameSchema);