const Joi = require("joi");

const createMinutes = (req, res, next) => {
  console.log("hello ji")
  const schema = Joi.object({
    title: Joi.string().trim().min(3).required(),
    description: Joi.string().allow("", null),
    text: Joi.string().allow("", null),
    meetingDate: Joi.date().required(),
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message,
    });
  }
  next();
};

module.exports = {
  createMinutes,
};
