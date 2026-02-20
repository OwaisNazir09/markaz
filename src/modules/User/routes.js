const express = require("express");
const Controller = require("./controller");
const auth = require("../../middlewares/auth");
const allowRoles = require("../../middlewares/role");
const validate = require("./validation");
const upload = require("../../middlewares/upload");

const router = express.Router();

const transformBody = (req, res, next) => {
  if (!req.body) return next();

  const newBody = { ...req.body };

  if (!newBody.profileDetails) newBody.profileDetails = {};
  if (!newBody.address) newBody.address = {};

  Object.keys(req.body).forEach((key) => {
    if (key.startsWith("profileDetails[")) {
      const match = key.match(/\[(.*?)\]/);
      if (match) {
        newBody.profileDetails[match[1]] = req.body[key];
        delete newBody[key];
      }
    } else if (key.startsWith("address[")) {
      const match = key.match(/\[(.*?)\]/);
      if (match) {
        newBody.address[match[1]] = req.body[key];
        delete newBody[key];
      }
    }
  });


  if (Object.keys(newBody.profileDetails).length === 0 && !req.body.profileDetails) delete newBody.profileDetails;
  if (Object.keys(newBody.address).length === 0 && !req.body.address) delete newBody.address;

  req.body = newBody;
  next();
};

router.post(
  "/CreateAcct",
  auth,
  allowRoles("admin"),
  upload("profilePicture"),
  transformBody,
  validate.createAcct,
  Controller.CreateAcct
);

router.get(
  "/GetAll",
  auth,
  allowRoles("admin", "accounts"),
  Controller.GetAllUsers
);

router.get(
  "/GetById/:id",
  auth,
  allowRoles("admin", "accounts"),
  Controller.GetUserById
);

router.get("/Me", auth, Controller.GetMe);

router.put(
  "/Update/:id",
  auth,
  allowRoles("admin"),
  upload("profilePicture"),
  transformBody,
  validate.updateAcct,
  Controller.UpdateUser
);

router.delete("/Delete/:id", auth, allowRoles("admin"), Controller.DeleteUser);

module.exports = router;
