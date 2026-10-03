import {Schema, model, InferSchemaType, Types} from "mongoose";

const organizationSchema = new Schema(
    {
        name: {type: String, required: true, trim: true},
        ownerId: {type: Schema.Types.ObjectId, ref: "User", required: true}
    },
    {timestamps: true}
);

export type IOrganization = InferSchemaType<typeof organizationSchema>;
export const Organization = model("Organisation", organizationSchema);