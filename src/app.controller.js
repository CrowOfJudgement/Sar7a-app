import express, { Router } from "express";
import { checkConnectionDB } from "./DB/connectionDB.js";
import userRouter from "./modules/users/user.controller.js";

const app = express();
const port = 3000;

const bootstrap = () => {

    checkConnectionDB();
    
    app.use(express.json()); 

    app.get('/', (req, res) => {
        res.status(200).json({ message: 'Welcome to my app' });
    });

    app.use(userRouter);

    app.use((req, res) => {
        res.status(404).json({ message: 'Not Found' });
    });

    app.use((err, req, res, next) => {
        const status = err.cause || 500;
        res.status(status).json({ 
            success: false,
            message: err.message,
            error: err.message 
        });
    });

    app.listen(port, () => {
        console.log(`🚀 Server is running on port ${port}`);
    });
};

export default bootstrap;