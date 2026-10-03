import {model, Schema, InferSchemaType} from "mongoose";

export const STATUSES = ["todo", "in_progress", "review", "done"] as const;
export const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type STATUS = (typeof STATUSES)[number];
export type PRIORITY = (typeof PRIORITIES)[number];

const ticketSchema = new Schema(
    {
        orgId:{type:Schema.Types.ObjectId, ref:"Organization", required:true},
        createdBy:{type:Schema.Types.ObjectId, required:true, ref:"User"},
        projectId:{type:Schema.Types.ObjectId, ref:"Project", required: true},
        title:{type:String, required:true, trim:true},
        description:{type:String, default:""},
        status:{type:String, enum:STATUSES, default:"todo"},
        priority:{type:String, enum:PRIORITIES, default:"medium"},
        assigneeId:{type:Schema.Types.ObjectId, ref:"User", default:null},
        labels:{type:[String], default:[]}
    },
    {timestamps:true}
)

ticketSchema.index({orgId:1, projectId:1, status:1});

export type ITicket = InferSchemaType<typeof ticketSchema>;
export const Ticket = model("Ticket", ticketSchema);