const Joi = require("joi");

const createNotificationSchema = Joi.object({
    title: Joi.string().required().trim().min(3).max(200),
    message: Joi.string().required().trim().min(3).max(1000),
    type: Joi.string().valid("system", "project", "document", "meeting").required(),
    data: Joi.object().optional(),
    selectedUsers: Joi.array().items(Joi.string()).optional(),
    sendToAll: Joi.boolean().optional(),
});

const validateCreateNotification = (req, res, next) => {
    const { error } = createNotificationSchema.validate(req.body);

    if (error) {
        return res.status(400).json({
            success: false,
            message: error.details[0].message,
        });
    }

    next();
};

module.exports = {
    validateCreateNotification,
};
