const Joi = require("joi");

const createCampaign = (req, res, next) => {
    const schema = Joi.object({
        title: Joi.string().required(),
        category: Joi.string().required(),
        targetAmount: Joi.number().min(1).required(),
        description: Joi.string().optional(),
        startDate: Joi.date().optional(),
        endDate: Joi.date().optional(),
        images: Joi.any().optional(),
    });

    const { error } = schema.validate(req.body, { allowUnknown: true });
    if (error)
        return res
            .status(400)
            .json({ success: false, message: error.details[0].message });

    next();
};

module.exports = {
    createCampaign,
};
