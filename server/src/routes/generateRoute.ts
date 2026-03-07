import { Router, type Router as ExpressRouter } from "express";
import { generateRules } from "../controller/generateController.js";

const generateRouter: ExpressRouter = Router();

generateRouter.post("/rules", generateRules);

export default generateRouter;
