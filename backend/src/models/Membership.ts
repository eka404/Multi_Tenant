import {Schema, model, Types, InferSchemaType} from "mongoose";

export const ROLES = ["owner", "lead", "contributor", "guest"] as const;
export type Role = (typeof ROLES)[number];

const membershipSchema = new Schema(
    {
        userId:{type:Schema.Types.ObjectId, ref:"User", required:true},
        orgId:{type:Schema.Types.ObjectId, ref:"Organization", required:true},
        role:{type:String, enum:["owner", "lead", "contributor", "guest"], required:true}
    },
    {timestamps:true}
);

membershipSchema.index({userId:1, orgId:1}, {unique: true});

export type IMembership = InferSchemaType<typeof membershipSchema>;
export const Membership = model("Membership", membershipSchema);