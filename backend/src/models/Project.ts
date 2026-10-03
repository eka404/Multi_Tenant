import { Schema, InferSchemaType, model } from "mongoose";

const projectSchema = new Schema(
    {
        orgId:{type:Schema.Types.ObjectId, ref:"Organization", required:true},
        createdBy:{type:Schema.Types.ObjectId, required:true, ref:"User"},
        name:{type:String, required:true, trim:true}
    },
    {timestamps:true}
)

projectSchema.index({orgId:1});

export type IProject = InferSchemaType<typeof projectSchema>;
export const Project = model("Project", projectSchema);