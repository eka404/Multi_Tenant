import type { Response } from "express";
import { Project } from "../models/Project.js";
import type { OrgScopedRequest } from "../middlewares/requireOrgMembership.js";

export async function createProject(req:OrgScopedRequest, res:Response) {
    const {name} = req.body as {name?:string};
    if(!name) return res.status(400).json({ message: "Project name is required" });

    const project = await Project.create({
        orgId: req.membership!.orgId,
        name,
        createdBy:req.userId
    });
    res.status(201).json({project});
}

export async function listProjects(req:OrgScopedRequest, res:Response) {
    const projects = await Project.find({ orgId: req.membership!.orgId }).sort({ createdAt: -1 });
    res.json({projects});
}