const express = require("express");
const router = express.Router();
const auth = require("../../middlewares/auth");
const allowRoles = require("../../middlewares/role");
const upload = require("../../middlewares/upload");
const validate = require("./validate");
const controller = require("./controller");

router.post(
  "/create",
  auth,
  allowRoles("admin"),
  upload("DispatchDocuments"),
  validate.validateDispatchSchema,
  controller.CreateDispatch
);

router.get("/", auth, controller.GetAllDispatch);

router.get("/:id", auth, controller.GetDispatchById);

router.put(
  "/:id",
  auth,
  allowRoles("admin"),
  upload("DispatchDocuments"),
  validate.validateDispatchSchema,
  controller.UpdateDispatch
);

router.delete("/:id", auth, allowRoles("admin"), controller.DeleteDispatch);

module.exports = router;
