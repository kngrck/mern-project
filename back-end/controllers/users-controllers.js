const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const HttpError = require("../models/http-error");
const User = require("../models/user");

//GET ALL USERS
const getUsers = async (req, res, next) => {
  let users;
  try {
    users = await User.find({}, "-password");
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not get users.", 500)
    );
  }

  res.json({ users: users.map((u) => u.toObject({ getters: true })) });
};

// SIGN UP
const signup = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs passed", 422));
  }
  const { name, email, password } = req.body;

  let existUser;
  try {
    existUser = await User.findOne({ email: email });
  } catch (err) {
    console.log(err);
    return next(new HttpError("Sign up failed,please try again later.C", 500));
  }

  if (existUser) {
    return next(new HttpError("User exist already.", 422));
  }

  let hashedPassword;
  try {
    hashedPassword = await bcrypt.hash(password, 12);
  } catch (error) {
    return next(new HttpError("Could not create user, please try again.", 500));
  }

  const createdUser = new User({
    name,
    email,
    image: req.file.path,
    password: hashedPassword,
    places: [],
  });

  try {
    await createdUser.save();
  } catch (err) {
    return next(new HttpError("Sign up failed,please try again later.", 500));
  }

  let token;
  try {
    token = jwt.sign(
      { userId: createdUser.id, email: createdUser.email },
      "supersecret_dont_share",
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Sign up failed,please try again later.", 500));
  }

  res
    .status(201)
    .json({ userId: createdUser.id, email: createdUser.email, token: token });
};

//LOGIN
const login = async (req, res, next) => {
  const { email, password } = req.body;

  let existUser;
  try {
    existUser = await User.findOne({ email: email });
  } catch (err) {
    console.log(err);
    return next(new HttpError("Login failed,please try again later.C", 500));
  }

  if (!existUser) {
    return next(new HttpError("Invalid credentials, could not log in.", 403));
  }

  let isValidPassword = false;
  try {
    isValidPassword = await bcrypt.compare(password, existUser.password);
  } catch (err) {
    return next(
      new HttpError(
        "Could not log you in,please check your credentials and try again",
        500
      )
    );
  }

  if (!isValidPassword) {
    return next(new HttpError("Invalid credentials, could not log in.", 403));
  }

  let token;
  try {
    token = jwt.sign(
      { userId: existUser.id, email: existUser.email },
      "supersecret_dont_share",
      { expiresIn: "1h" }
    );
  } catch (error) {
    return next(new HttpError("Login failed,please try again later.", 500));
  }

  res.json({
    userId: existUser.id,
    email: existUser.email,
    token: token,
  });
};

exports.getUsers = getUsers;
exports.signup = signup;
exports.login = login;
