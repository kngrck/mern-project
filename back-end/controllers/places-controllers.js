const fs = require("fs");

const { uuid: uuidv4 } = require("uuid");
const { validationResult } = require("express-validator");
const mongoose = require("mongoose");

const HttpError = require("../models/http-error");
const Place = require("../models/place");
const User = require("../models/user");

//GET PLACE BY ID
const getPlaceById = async (req, res, next) => {
  const placeId = req.params.pid; // { pid: 'p1' }
  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    const error = new HttpError(
      "Something went wrong,could not find a place.",
      500
    );
    return next(error);
  }

  if (!place) {
    const error = new HttpError(
      "Could not find a place for the provided id.",
      404
    );

    return next(error);
  }
  res.json({ place: place.toObject({ getters: true }) }); // => { place } => { place: place }
};

//GET PLACES BY USER ID
const getPlacesByUserId = async (req, res, next) => {
  const userId = req.params.uid;

  let userWithPlaces;
  try {
    userWithPlaces = await User.findById(userId).populate("places");
  } catch (err) {
    const error = new HttpError(
      "Something went wrong,could not find places.",
      500
    );
    return next(error);
  }

  if (!userWithPlaces || userWithPlaces.places.length === 0) {
    return next(
      new HttpError("Could not find a place for the provided user id.", 404)
    );
  }
  res.json({
    places: userWithPlaces.places.map((p) => p.toObject({ getters: true })),
  });
};

//CREATE PLACE
const createPlace = async (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs passed", 422));
  }
  const { title, description, coordinates, address } = req.body;
  const createdPlace = new Place({
    title,
    description,
    address,
    location: { lat: 40, lng: 50 },
    image: req.file.path,
    creator: req.userData.userId,
  });

  let user;

  try {
    user = await User.findById(req.userData.userId);
  } catch (err) {
    return next(new HttpError("Creating place failed, please try again.", 500));
  }

  if (!user) {
    return next(new HttpError("We could not find user for provided id", 404));
  }

  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    await createdPlace.save({ session: sess });
    user.places.push(createdPlace);
    await user.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    console.log(err);
    const error = new HttpError(
      "Creating place failed, please try again.",
      500
    );
    return next(error);
  }

  res.status(201).json({ place: createdPlace });
};

//UPDATE PLACE
const updatePlaceById = async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpError("Invalid inputs passed", 422));
  }
  const { title, description } = req.body;
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId);
  } catch (err) {
    return next(
      new HttpError(
        "Something went wrong, could not find a place to update.",
        500
      )
    );
  }

  if (place.creator.toString() !== req.userData.userId) {
    return next(new HttpError("You are not allowed to edit this place.", 401));
  }

  place.title = title;
  place.description = description;

  try {
    await place.save();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not update a place.", 500)
    );
  }

  res.status(200).json({ place: place.toObject({ getters: true }) });
};

//DELETE PLACE
const deletePlaceById = async (req, res, next) => {
  const placeId = req.params.pid;

  let place;
  try {
    place = await Place.findById(placeId).populate("creator");
  } catch (err) {
    return next(
      new HttpError(
        "Something went wrong, could not find a place to delete.",
        500
      )
    );
  }

  if (!place) {
    return next(new HttpError("Could not find a place.", 404));
  }
  if (place.creator.id !== req.userData.userId) {
    return next(
      new HttpError("You are not allowed to delete this place.", 401)
    );
  }
  const imagePath = place.image;
  try {
    const sess = await mongoose.startSession();
    sess.startTransaction();
    place.remove({ session: sess });
    place.creator.places.pull(place);
    await place.creator.save({ session: sess });
    await sess.commitTransaction();
  } catch (err) {
    return next(
      new HttpError("Something went wrong, could not delete a place.", 500)
    );
  }

  fs.unlink(imagePath, (err) => {
    console.log(err);
  });

  res.status(200).json({ message: "Deleted place." });
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByUserId = getPlacesByUserId;
exports.createPlace = createPlace;
exports.updatePlaceById = updatePlaceById;
exports.deletePlaceById = deletePlaceById;
