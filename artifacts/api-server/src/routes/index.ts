import { Router, type IRouter } from "express";
import healthRouter from "./health";
import imagesRouter from "./images";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);
router.use(imagesRouter);
router.use(projectsRouter);

export default router;
