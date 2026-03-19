import Joi from 'joi';

export const signUpSchema = {
    body: Joi.object({
        firstName: Joi.string().min(2).max(30).required(),
        lastName: Joi.string().min(2).max(30).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        age: Joi.number().integer().min(0).max(120),
        gender: Joi.string().valid('male', 'female').required(),
    })
};

export const signInSchema = {
    body: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required()
    })
};

export const confirmEmailSchema = {
    body: Joi.object({
        email: Joi.string().email().required(),
        otp: Joi.string().length(6).required()
    })
};

export const confirmSignInSchema = confirmEmailSchema;

export const otpOnlySchema = {
    body: Joi.object({
        otp: Joi.string().length(6).required()
    })
};

export const updatePasswordSchema = {
    body: Joi.object({
        currentPassword: Joi.string().min(6).required(),
        newPassword: Joi.string().min(6).required()
    })
};

export const forgetPasswordSchema = {
    body: Joi.object({
        email: Joi.string().email().required()
    })
};

export const resetPasswordSchema = {
    body: Joi.object({
        email: Joi.string().email().required(),
        otp: Joi.string().length(6).required(),
        newPassword: Joi.string().min(6).required()
    })
};

export const loginWithGmailSchema = {
    body: Joi.object({
        idToken: Joi.string().required()
    })
};
