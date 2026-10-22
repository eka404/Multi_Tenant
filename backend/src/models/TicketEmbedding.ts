import { Schema, model, InferSchemaType } from "mongoose";

const ticketEmbeddingSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    embeddingModel: { type: String, required: true },
    textHash: { type: String, required: true }, // lets us skip tickets whose text hasn't changed
    vector: { type: [Number], required: true },
  },
  { timestamps: true }
);

ticketEmbeddingSchema.index({ ticketId: 1 }, { unique: true });
ticketEmbeddingSchema.index({ orgId: 1, projectId: 1, embeddingModel: 1, updatedAt: -1 });

export type ITicketEmbedding = InferSchemaType<typeof ticketEmbeddingSchema>;
export const TicketEmbedding = model("TicketEmbedding", ticketEmbeddingSchema);