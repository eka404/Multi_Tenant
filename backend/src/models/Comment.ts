import { Schema, model, InferSchemaType } from "mongoose";

const commentSchema = new Schema(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    orgId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, required: true, trim: true },
    mentionedUserIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
  },
  { timestamps: true }
);

commentSchema.index({ ticketId: 1, createdAt: 1 });

export type IComment = InferSchemaType<typeof commentSchema>;
export const Comment = model("Comment", commentSchema);