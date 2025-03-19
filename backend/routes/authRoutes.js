const express = require("express");
const { body } = require("express-validator");
const { registerUser, loginUser } = require("../controllers/authControllers");

const router = express.Router();

// Validation rules
const validateSignup = [
  body("email").isEmail().withMessage("Invalid email format"),
  body("fullName").notEmpty().withMessage("Full name is required"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("confirmPassword").custom((value, { req }) => {
    if (value !== req.body.password) throw new Error("Passwords do not match");
    return true;
  }),
];

const validateLogin = [
  body("email").isEmail().withMessage("Invalid email format"),
  body("password").notEmpty().withMessage("Password is required"),
];

// Routes
router.post("/signup", validateSignup, registerUser);
router.post("/login", validateLogin, loginUser);

module.exports = router;
