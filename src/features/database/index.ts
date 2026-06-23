import { Context, Layer } from "effect";
import { db } from "../../database/index.js";

export class Database extends Context.Tag("Database")<Database, typeof db>() {}

export const DatabaseLive = Layer.succeed(Database, db);
