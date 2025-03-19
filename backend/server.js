const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const userRoutes = require("./routes/authRoutes");

dotenv.config();
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/users", userRoutes);


const PORT = process.env.PORT || 5500;
app.listen(PORT, "0.0.0.0", () => console.log(`Server running on port ${PORT}`));
