const Joi = require("joi");

const validateDispatchSchema = (req, res, next) => {
  const schema = Joi.object({
    title: Joi.string().trim().min(3).required(),
    dispatchNo: Joi.string().trim().required(),
    dispatchDate: Joi.date().optional(),
    to: Joi.string().trim().when("isIndependent", {
      is: true,
      then: Joi.required(),
      otherwise: Joi.allow("", null),
    }),
    subject: Joi.string().trim().required(),
    remarks: Joi.string().trim().allow("", null),
    isIndependent: Joi.boolean().default(true),
    assignedUser: Joi.string().trim().when("isIndependent", {
      is: false,
      then: Joi.required(),
      otherwise: Joi.allow("", null),
    }),
  });

  const { error } = schema.validate(req.body, { abortEarly: false });

  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation error",
      errors: error.details.map((err) => err.message),
    });
  }

  next();
};

module.exports = { validateDispatchSchema };
