import bodyParser from "body-parser";
import express from "express";
import session from "express-session";
import authRoutes from "./routes/authRoutes";
import chatbotRoutes from "./routes/chatbotRoutes";

const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "SOME_SECRET_KEY",
    resave: false,
    saveUninitialized: true,
  })
);

app.use("/", (req, res, next) => {
  res.send("Hello World");
});

// Register routes
app.use("/auth", authRoutes);
// app.use("/remitentes", remitenteRoutes);
app.use("/chatbot", chatbotRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;
