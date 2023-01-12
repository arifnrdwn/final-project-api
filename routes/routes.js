require("dotenv").config();
const express = require("express");
const jwt = require("jsonwebtoken");
const authenticateJWT = require("../middleware/jwtAuthenticator");
const { User, Note, NoteSharing } = require("../models");
const { ValidationError } = require("sequelize");
const bcrypt = require("bcrypt");
const router = express.Router();

router.post("/", async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ where: { username: username } });
    if (!user) {
      return res.send("Invalid Username");
    }
    const result = await bcrypt.compare(password, user.password);
    if (result) {
      let token = jwt.sign(
        {
          id: user.id,
          username: user.username,
        },
        process.env.JWT_ACCESS_KEY,
        {
          expiresIn: 86400, //24h expired
        }
      );
      res.cookie("auth", token);
      res.send({ error: 0, message: `Login as ${user.username} successfully` });
    } else {
      return res.send("Invalid Password");
    }
  } catch (error) {
    return res.sendStatus(404);
  }
});

router.post("/signup", async (req, res) => {
  const { username, password } = req.body;

  try {
    if (username == "") {
      return res.send({ error: 1, message: "Username can't be empty" });
    }
    if (password == "") {
      return res.send({ error: 1, message: "Password can't be empty" });
    }

    const hashPassword = await bcrypt.hash(password, 10);

    const user = await User.create({ username, password: hashPassword });
    res.send({
      error: 0,
      message: "User created successfully",
      data: {
        id: user.id,
        username: user.username,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return res.send({ error: 1, message: error.errors[0].message });
    }
    res.sendStatus(500);
  }
});

router.post("/create-notes", authenticateJWT, async (req, res) => {
  const { title, body, type } = req.body;
  const { id } = req.user;
  try {
    const note = await Note.create({ title, body, type, userId: id });
    res.send({
      error: 0,
      message: "Note saved Successfully",
      data: note,
    });
  } catch (error) {
    console.log(error);
    res.sendStatus(500);
  }
});

router.get("/note/:id", authenticateJWT, async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const note = await Note.findOne({ where: { id } });
    res.send({ note, user });
  } catch (error) {
    console.log(error);
    res.sendStatus(401);
  }
});

router.post("/note/:id", authenticateJWT, async (req, res) => {
  const { sharedUser } = req.body;
  const { id } = req.params;
  try {
    const user = await User.findOne({ where: { username: sharedUser } });

    if (!user) {
      return res.send({ error: 1, message: "User not found" });
    }

    const noteSharing = await NoteSharing.create({
      userId: user.id,
      noteId: id,
    });

    res.send({ error: 0, message: `Shared to ${user.username} successfully` });
  } catch (error) {
    console.log(error);
    res.sendStatus(401);
  }
});

router.get("/notes", authenticateJWT, async (req, res) => {
  const { id } = req.user;
  try {
    const notes = await Note.findAll({
      where: { userId: id },
      include: [
        {
          model: User,
        },
      ],
    });

    const sharedNotes = await User.findOne({
      where: { id },
      include: [
        {
          model: Note,
          as: "notes",
          include: {
            model: User,
          },
        },
      ],
    });
    res.send({ data: notes, user: req.user, sharedNotes: sharedNotes });
  } catch (error) {
    res.sendStatus(401);
  }
});

module.exports = router;
