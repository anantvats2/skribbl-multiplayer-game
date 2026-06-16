import express from "express";
import http from "http";
import cors from "cors";
import { setupSocket } from "./socket/socketHandlers";
import { setupCommandLine } from "./utils/commandline";

const app = express();
const server = http.createServer(app);
app.use(cors());

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
setupSocket(io);
setupCommandLine(io);

const PORT = process.env.PORT || 8000;
server.listen(PORT, function () {
  console.log(`listening on *:${PORT}`);
});
