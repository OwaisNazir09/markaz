const Joi = require("joi");

const createAcct = (req, res, next) => {
  const schema = Joi.object({
    profileDetails: Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      phone: Joi.string().optional().allow(''),
      gender: Joi.string().valid("male", "female", "other").optional(),
      dob: Joi.date().optional(),
    }).required(),
    address: Joi.object({
      line1: Joi.string().optional().allow(''),
      line2: Joi.string().optional().allow(''),
      city: Joi.string().optional().allow(''),
      state: Joi.string().optional().allow(''),
      country: Joi.string().optional().allow(''),
      pincode: Joi.string().optional().allow(''),
    }).optional(),
    password: Joi.string().min(6).required(),
    role: Joi.string().optional(),
    status: Joi.boolean().optional(),
  });

  const { error } = schema.validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });

  next();
};

const updateAcct = (req, res, next) => {
  const schema = Joi.object({
    profileDetails: Joi.object({
      name: Joi.string().optional(),
      email: Joi.string().email().optional(),
      phone: Joi.string().optional().allow(''),
      gender: Joi.string().valid("male", "female", "other").optional(),
      dob: Joi.date().optional(),
    }).optional(),
    address: Joi.object({
      line1: Joi.string().optional().allow(''),
      line2: Joi.string().optional().allow(''),
      city: Joi.string().optional().allow(''),
      state: Joi.string().optional().allow(''),
      country: Joi.string().optional().allow(''),
      pincode: Joi.string().optional().allow(''),
    }).optional(),
    password: Joi.string().min(6).optional().allow(''),
    role: Joi.string().optional(),
    status: Joi.boolean().optional(),
  });

  const { error } = schema.validate(req.body);
  if (error)
    return res
      .status(400)
      .json({ success: false, message: error.details[0].message });

  next();
};

module.exports = { createAcct, updateAcct };
