import { Schema, model, InferSchemaType } from "mongoose";

const notificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["mention", "assigned"], required: true },
    ticketId: { type: Schema.Types.ObjectId, ref: "Ticket", required: true },
    commentId: { type: Schema.Types.ObjectId, ref: "Comment", default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, read: 1, createdAt: -1 });

export type INotification = InferSchemaType<typeof notificationSchema>;
export const Notification = model("Notification", notificationSchema);