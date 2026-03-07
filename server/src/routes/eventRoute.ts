import { Router, type Router as ExpressRouter } from "express";
import {
  analyseEvent,
  createEvent,
  getAllEvents,
  getEventById,
  getEventStatus,
} from "../controller/eventController.js";

const eventRouter: ExpressRouter = Router();

// used by daemon to create new event
eventRouter.post("/new", createEvent);

// used by dashboard 
eventRouter.get("/all", getAllEvents);
eventRouter.get("/analyse/:uuid", analyseEvent);
eventRouter.get("/status/:uuid", getEventStatus);
eventRouter.get("/:uuid", getEventById);

export default eventRouter;
